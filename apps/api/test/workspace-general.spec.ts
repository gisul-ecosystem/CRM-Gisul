import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../src/workspace/workspace.service";

describe("WorkspaceService General Settings", () => {
	const mockDb = {
		organization: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		member: {
			findUnique: vi.fn().mockResolvedValue({ role: "owner" }),
			findMany: vi.fn().mockResolvedValue([
				{
					id: "m-1",
					role: "owner",
					createdAt: new Date("2025-01-01"),
					userId: "u-1",
					user: {
						name: "John Doe",
						email: "john@example.com",
						image: null,
						updatedAt: new Date(),
						sessions: [{ updatedAt: new Date() }],
					},
				},
			]),
			findFirst: vi.fn(),
			groupBy: vi.fn().mockResolvedValue([]),
			count: vi.fn().mockResolvedValue(1),
		},
	};

	const mockAgent = {
		workspaceChanged: vi.fn().mockResolvedValue(undefined),
	} as any;

	it("returns workspace details, regional settings and preferences from metadata", async () => {
		mockDb.organization.findUnique.mockResolvedValueOnce({
			id: "ws-1",
			slug: "gisul-tech",
			name: "Gisul Technologies",
			website: "https://gisul.id",
			metadata: JSON.stringify({
				industry: "Financial Services",
				companySize: "51-200 employees",
				description: "Enterprise CRM and SaaS platform",
				logoUrl: "https://example.com/logo.png",
				timezone: "(GMT+05:30) Asia/Kolkata",
				dateFormat: "25 Sep 2025",
				timeFormat: "24-hour",
				currency: "INR",
				preferences: {
					showProductFilterInAllModules: true,
					enableEmailNotifications: false,
					autoAssignNewLeads: true,
					enableDesktopNotifications: true,
					allowDuplicateLeads: false,
					setFollowUpReminders: true,
				},
			}),
		});

		mockDb.member.findFirst.mockResolvedValueOnce({
			id: "m-1",
			role: "owner",
			userId: "u-1",
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const result = await service.get("u-1");

		expect(result.name).toBe("Gisul Technologies");
		expect(result.industry).toBe("Financial Services");
		expect(result.companySize).toBe("51-200 employees");
		expect(result.description).toBe("Enterprise CRM and SaaS platform");
		expect(result.logoUrl).toBe("https://example.com/logo.png");
		expect(result.timezone).toBe("(GMT+05:30) Asia/Kolkata");
		expect(result.timeFormat).toBe("24-hour");
		expect(result.currency).toBe("INR");
		expect(result.preferences.enableEmailNotifications).toBe(false);
		expect(result.preferences.autoAssignNewLeads).toBe(true);
	});

	it("updates workspace details, regional settings and preferences", async () => {
		mockDb.member.findFirst.mockResolvedValueOnce({
			id: "m-1",
			role: "owner",
			userId: "u-1",
		});

		mockDb.organization.findUnique.mockResolvedValueOnce({
			id: "ws-1",
			website: "gisul.id",
			metadata: JSON.stringify({
				industry: "Technology",
				companySize: "11-50 employees",
			}),
		});

		mockDb.organization.update.mockResolvedValueOnce({
			id: "ws-1",
			slug: "gisul-tech",
			name: "Gisul Inc",
			website: "gisul.com",
			metadata: JSON.stringify({
				industry: "Retail & E-commerce",
				companySize: "500+ employees",
				description: "Global e-commerce platform",
				timezone: "(GMT+00:00) UTC",
				currency: "USD",
				preferences: {
					showProductFilterInAllModules: false,
					enableEmailNotifications: true,
					autoAssignNewLeads: false,
					enableDesktopNotifications: false,
					allowDuplicateLeads: true,
					setFollowUpReminders: false,
				},
			}),
		});

		mockDb.organization.findUnique.mockResolvedValueOnce({
			id: "ws-1",
			slug: "gisul-tech",
			name: "Gisul Inc",
			website: "gisul.com",
			metadata: JSON.stringify({
				industry: "Retail & E-commerce",
				companySize: "500+ employees",
				description: "Global e-commerce platform",
				timezone: "(GMT+00:00) UTC",
				currency: "USD",
				preferences: {
					showProductFilterInAllModules: false,
					enableEmailNotifications: true,
					autoAssignNewLeads: false,
					enableDesktopNotifications: false,
					allowDuplicateLeads: true,
					setFollowUpReminders: false,
				},
			}),
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const result = await service.update("u-1", {
			name: "Gisul Inc",
			website: "gisul.com",
			industry: "Retail & E-commerce",
			companySize: "500+ employees",
			description: "Global e-commerce platform",
			timezone: "(GMT+00:00) UTC",
			currency: "USD",
			preferences: {
				showProductFilterInAllModules: false,
				enableEmailNotifications: true,
				autoAssignNewLeads: false,
				enableDesktopNotifications: false,
				allowDuplicateLeads: true,
				setFollowUpReminders: false,
			},
		});

		expect(result.name).toBe("Gisul Inc");
		expect(result.industry).toBe("Retail & E-commerce");
		expect(result.companySize).toBe("500+ employees");
		expect(result.description).toBe("Global e-commerce platform");
		expect(result.currency).toBe("USD");
		expect(result.preferences.allowDuplicateLeads).toBe(true);
	});

	it("computes teams and roles dynamically without static dummy counts", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-tech",
			name: "Gisul Technologies",
			metadata: "{}",
		});

		mockDb.member.findMany.mockResolvedValue([
			{
				id: "m-1",
				role: "sales-manager",
				createdAt: new Date(),
				userId: "u-1",
				user: {
					name: "Sales User",
					email: "sales@example.com",
					sessions: [],
				},
			},
			{
				id: "m-2",
				role: "marketing",
				createdAt: new Date(),
				userId: "u-2",
				user: {
					name: "Marketing User",
					email: "mkt@example.com",
					sessions: [],
				},
			},
		]);

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const teams = await service.teams("u-1");
		const roles = await service.roles("u-1");

		expect(teams.find((t) => t.id === "sales")?.memberCount).toBe(1);
		expect(teams.find((t) => t.id === "marketing")?.memberCount).toBe(1);
		expect(roles.find((r) => r.id === "sales-manager")?.userCount).toBe(1);
		expect(roles.find((r) => r.id === "marketing")?.userCount).toBe(1);
	});
});
