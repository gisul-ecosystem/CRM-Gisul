import { describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import type { Db } from "@crm/db";
import { WorkspaceService } from "../src/workspace/workspace.service";

type MockTeam = { id: string; name: string };
type MockLink = { memberId: string; teamId: string };

function recently(): Date {
	return new Date(Date.now() - 60_000);
}

function longAgo(): Date {
	return new Date(Date.now() - 400 * 24 * 60 * 60_000);
}

function buildService() {
	const teams: MockTeam[] = [
		{ id: "team_sales", name: "Sales" },
		{ id: "team_product", name: "Product" },
	];
	const links: MockLink[] = [];
	const members = [
		{
			id: "mem-1",
			userId: "usr-1",
			organizationId: WORKSPACE_ID,
			role: "owner",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			user: {
				name: "Owner Person",
				email: "owner@example.com",
				image: null,
				sessions: [{ updatedAt: recently() }],
			},
		},
		{
			id: "mem-2",
			userId: "usr-2",
			organizationId: WORKSPACE_ID,
			role: "member",
			createdAt: new Date("2026-01-02T00:00:00Z"),
			user: {
				name: "Member Person",
				email: "member@example.com",
				image: null,
				sessions: [{ updatedAt: longAgo() }],
			},
		},
	];

	const withTeam = (member: (typeof members)[number]) => {
		const link = links.find((entry) => entry.memberId === member.id);
		const team = teams.find((entry) => entry.id === link?.teamId);
		return {
			...member,
			team:
				link && team ? { teamId: team.id, team: { name: team.name } } : null,
		};
	};

	const db = {
		member: {
			async findMany(args: {
				where?: { user?: { OR?: { name: { contains: string } }[] } };
			}) {
				const term = args.where?.user?.OR?.[0]?.name.contains.toLowerCase();
				return members
					.filter(
						(member) =>
							!term ||
							member.user.name.toLowerCase().includes(term) ||
							member.user.email.toLowerCase().includes(term),
					)
					.map(withTeam);
			},
			async findUnique(args: {
				where: { id?: string; organizationId_userId?: { userId: string } };
			}) {
				const match = args.where.organizationId_userId
					? members.find(
							(member) =>
								member.userId === args.where.organizationId_userId?.userId,
						)
					: members.find((member) => member.id === args.where.id);
				return match ? withTeam(match) : null;
			},
			async findUniqueOrThrow(args: { where: { id: string } }) {
				const match = members.find((member) => member.id === args.where.id);
				if (!match) throw new Error("not found");
				return withTeam(match);
			},
			async findFirst(args: { where: { id: string } }) {
				return members.find((member) => member.id === args.where.id) ?? null;
			},
			async count() {
				return members.length;
			},
			async groupBy() {
				return [
					{ role: "owner", _count: { _all: 1 } },
					{ role: "member", _count: { _all: 1 } },
					{ role: "Sales Manager", _count: { _all: 2 } },
				];
			},
		},
		team: {
			async findMany() {
				return teams.map((team) => ({
					...team,
					_count: {
						members: links.filter((link) => link.teamId === team.id).length,
					},
				}));
			},
			async findUnique(args: { where: { id: string } }) {
				return teams.find((team) => team.id === args.where.id) ?? null;
			},
			async create(args: { data: { name: string } }) {
				const team = { id: `team_${teams.length + 1}`, name: args.data.name };
				teams.push(team);
				return team;
			},
		},
		memberTeam: {
			async upsert(args: { create: MockLink; update: { teamId: string } }) {
				const existing = links.find(
					(link) => link.memberId === args.create.memberId,
				);
				if (existing) existing.teamId = args.update.teamId;
				else links.push({ ...args.create });
				return args.create;
			},
			async deleteMany(args: { where: { memberId: string } }) {
				const index = links.findIndex(
					(link) => link.memberId === args.where.memberId,
				);
				if (index >= 0) links.splice(index, 1);
				return { count: index >= 0 ? 1 : 0 };
			},
		},
	} as unknown as Db;

	const agent = { workspaceChanged: async () => {} } as never;

	return { service: new WorkspaceService(db, agent), links };
}

describe("Workspace teams and roles", () => {
	it("lists teams stored in the database with real member counts", async () => {
		const { service } = buildService();
		const teams = await service.teams();

		expect(teams).toEqual([
			{ id: "team_sales", name: "Sales", memberCount: 0 },
			{ id: "team_product", name: "Product", memberCount: 0 },
		]);
	});

	it("lists only the three real roles and folds unknown role strings into member", async () => {
		const { service } = buildService();
		const roles = await service.roles();

		expect(roles).toEqual([
			{ id: "owner", userCount: 1 },
			{ id: "admin", userCount: 0 },
			{ id: "member", userCount: 3 },
		]);
	});

	it("lets an owner create a team", async () => {
		const { service } = buildService();
		const team = await service.createTeam("usr-1", { name: "Enterprise" });

		expect(team.name).toBe("Enterprise");
		expect(team.memberCount).toBe(0);
	});

	it("refuses to let a member create a team", async () => {
		const { service } = buildService();

		await expect(
			service.createTeam("usr-2", { name: "Enterprise" }),
		).rejects.toThrow("Only an owner or an admin can add a team.");
	});

	it("saves a member's team and clears it again", async () => {
		const { service, links } = buildService();

		const moved = await service.updateMemberTeam("usr-1", {
			memberId: "mem-2",
			teamId: "team_product",
		});
		expect(moved.teamId).toBe("team_product");
		expect(moved.team).toBe("Product");
		expect(links).toEqual([{ memberId: "mem-2", teamId: "team_product" }]);

		const cleared = await service.updateMemberTeam("usr-1", {
			memberId: "mem-2",
			teamId: null,
		});
		expect(cleared.team).toBeNull();
		expect(links).toEqual([]);
	});

	it("rejects a team that does not exist", async () => {
		const { service } = buildService();

		await expect(
			service.updateMemberTeam("usr-1", {
				memberId: "mem-2",
				teamId: "team_missing",
			}),
		).rejects.toThrow("That team does not exist.");
	});

	it("points the invite card at the real sign-in page", () => {
		const { service } = buildService();
		const settings = service.invitationSettings();

		expect(settings.signInUrl.endsWith("/sign-in")).toBe(true);
		expect(settings.defaultRole).toBe("member");
		expect(Array.isArray(settings.allowedDomains)).toBe(true);
	});

	it("derives status and last activity from the newest session", async () => {
		const { service } = buildService();
		const result = await service.members("usr-1", {
			page: 1,
			pageSize: 10,
			q: "",
			sort: "",
			dir: "asc",
			role: [],
			team: [],
			status: [],
		});

		const owner = result.rows.find((row) => row.id === "mem-1");
		const member = result.rows.find((row) => row.id === "mem-2");

		expect(owner?.status).toBe("active");
		expect(owner?.isViewer).toBe(true);
		expect(owner?.lastActive).not.toBeNull();
		expect(member?.status).toBe("inactive");
		expect(member?.role).toBe("member");
	});
});
