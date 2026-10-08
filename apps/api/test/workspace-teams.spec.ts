import { describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import type { Db } from "@crm/db";
import { WorkspaceService } from "../src/workspace/workspace.service";

describe("Workspace Teams & Roles Service", () => {
	const mockMembers = [
		{
			id: "mem-1",
			userId: "usr-1",
			organizationId: WORKSPACE_ID,
			role: "owner",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			user: {
				name: "Rahul Kumar",
				email: "rahul@gisul.id",
				image: null,
				updatedAt: new Date("2026-10-08T11:20:00Z"),
				sessions: [{ updatedAt: new Date("2026-10-08T11:20:00Z") }],
			},
		},
		{
			id: "mem-2",
			userId: "usr-2",
			organizationId: WORKSPACE_ID,
			role: "member",
			createdAt: new Date("2026-01-02T00:00:00Z"),
			user: {
				name: "Priya Mehta",
				email: "priya@gisul.id",
				image: null,
				updatedAt: new Date("2026-10-08T09:15:00Z"),
				sessions: [{ updatedAt: new Date("2026-10-08T09:15:00Z") }],
			},
		},
	];

	const mockInvitations: any[] = [];

	const mockDb = {
		organization: {
			async findUnique(args: any) {
				return {
					id: WORKSPACE_ID,
					slug: "gisul-software-services",
					name: "Gisul Software Services",
					website: "gisul.co.in",
					metadata: JSON.stringify({ onboarded: true }),
				};
			},
			async update(args: any) {
				return args.data;
			},
		},
		member: {
			async findMany(args: any) {
				let filtered = [...mockMembers];
				if (args.where?.user?.OR) {
					const term = args.where.user.OR[0].name.contains.toLowerCase();
					filtered = filtered.filter(
						(m) =>
							m.user.name.toLowerCase().includes(term) ||
							m.user.email.toLowerCase().includes(term),
					);
				}
				if (args.where?.role?.in) {
					filtered = filtered.filter((m) =>
						args.where.role.in.includes(m.role),
					);
				}
				return filtered.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? 10));
			},
			async findUnique(args: any) {
				if (args.where?.organizationId_userId) {
					return (
						mockMembers.find(
							(m) =>
								m.userId === args.where.organizationId_userId.userId &&
								m.organizationId === args.where.organizationId_userId.organizationId,
						) ?? null
					);
				}
				return mockMembers.find((m) => m.id === args.where.id) ?? null;
			},
			async findFirst(args: any) {
				return mockMembers.find((m) => m.id === args.where.id) ?? null;
			},
			async count(args: any) {
				return mockMembers.length;
			},
			async groupBy(args: any) {
				return [{ role: "owner", _count: { _all: 1 } }, { role: "member", _count: { _all: 1 } }];
			},
			async update(args: any) {
				const target = mockMembers.find((m) => m.id === args.where.id);
				if (target) {
					target.role = args.data.role ?? target.role;
				}
				return target;
			},
		},
		invitation: {
			async create(args: any) {
				mockInvitations.push(args.data);
				return args.data;
			},
		},
		$transaction: async (cb: any) => {
			return cb(mockDb);
		},
		$queryRaw: async () => [{ id: "mem-1" }, { id: "mem-owner-2" }],
	} as unknown as Db;

	const mockAgent = {
		workspaceChanged: async () => {},
	} as any;

	const service = new WorkspaceService(mockDb, mockAgent);

	it("lists default teams with member counts", async () => {
		const teams = await service.teams("usr-1");
		expect(teams.length).toBeGreaterThanOrEqual(4);
		expect(teams.map((t) => t.name)).toContain("Sales");
		expect(teams.map((t) => t.name)).toContain("Product");
		expect(teams.map((t) => t.name)).toContain("Marketing");
		expect(teams.map((t) => t.name)).toContain("Customer Success");
	});

	it("lists standard and custom roles with descriptions", async () => {
		const roles = await service.roles("usr-1");
		expect(roles.length).toBeGreaterThanOrEqual(5);
		const salesManager = roles.find((r) => r.name === "Sales Manager");
		expect(salesManager).toBeDefined();
		expect(salesManager?.description).toBe("Full access to sales data");
	});

	it("creates a new team with normalized slug id", async () => {
		const newTeam = await service.createTeam("usr-1", {
			name: "Enterprise Solutions",
			icon: "briefcase",
		});
		expect(newTeam.name).toBe("Enterprise Solutions");
		expect(newTeam.id).toBe("enterprise-solutions");
		expect(newTeam.icon).toBe("briefcase");
	});

	it("creates a custom role with permissions", async () => {
		const newRole = await service.createRole("usr-1", {
			name: "Compliance Officer",
			description: "Audit logs and data retention",
			permissions: "read:audit,write:compliance",
		});
		expect(newRole.name).toBe("Compliance Officer");
		expect(newRole.description).toBe("Audit logs and data retention");
		expect(newRole.permissions).toBe("read:audit,write:compliance");
	});

	it("retrieves invitation settings with proper workspace slug", async () => {
		const settings = await service.invitationSettings("usr-1");
		expect(settings.allowUserInvitations).toBe(true);
		expect(settings.defaultRole).toBe("Viewer");
		expect(settings.inviteLink).toBe("https://crm.gisul.id/invite/gisul-software-services");
	});

	it("invites a new user and stores invitation in database", async () => {
		// Mock auth check
		const result = await service.inviteUser("usr-1", {
			email: "newmember@gisul.id",
			role: "Sales Executive",
			team: "Sales",
		});
		expect(result.success).toBe(true);
		expect(result.email).toBe("newmember@gisul.id");
		expect(mockInvitations.length).toBe(1);
		expect(mockInvitations[0].email).toBe("newmember@gisul.id");
		expect(mockInvitations[0].status).toBe("pending");
	});

	it("updates a member's team assignment", async () => {
		const updated = await service.updateMemberTeam("usr-1", {
			memberId: "mem-2",
			team: "Product",
		});
		expect(updated.team).toBe("Product");
	});

	it("updates a member's status (active/pending/inactive)", async () => {
		const updated = await service.updateMemberStatus("usr-1", {
			memberId: "mem-2",
			status: "inactive",
		});
		expect(updated.status).toBe("inactive");
	});

	it("lists members with enriched metadata, pagination and search", async () => {
		const result = await service.members("usr-1", {
			page: 1,
			pageSize: 10,
			q: "Priya",
			role: [],
			team: [],
			status: [],
		});
		expect(result.rows.length).toBe(1);
		expect(result.rows[0]?.name).toBe("Priya Mehta");
		expect(result.rows[0]?.email).toBe("priya@gisul.id");
		expect(result.rows[0]?.isViewer).toBe(false);
	});
});
