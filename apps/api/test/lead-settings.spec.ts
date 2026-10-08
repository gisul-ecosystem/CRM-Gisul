import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../src/workspace/workspace.service";

describe("WorkspaceService Lead Settings", () => {
	const mockDb = {
		organization: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		contact: {
			groupBy: vi.fn().mockResolvedValue([
				{ leadSource: "WEBSITE", _count: { _all: 124 } },
				{ leadSource: "LINKEDIN", _count: { _all: 86 } },
				{ leadSource: "REFERRAL", _count: { _all: 42 } },
				{ leadSource: "COLD_OUTREACH", _count: { _all: 37 } },
				{ leadStatus: "NEW", _count: { _all: 50 } },
				{ leadStatus: "QUALIFIED", _count: { _all: 30 } },
			]),
		},
		member: {
			findFirst: vi.fn().mockResolvedValue({
				userId: "u-owner-1",
				role: "Sales Manager",
				user: {
					name: "Rahul Kumar",
					image: null,
				},
			}),
			findMany: vi.fn().mockResolvedValue([]),
		},
	};

	const mockAgent = {
		workspaceChanged: vi.fn().mockResolvedValue(undefined),
	} as any;

	it("retrieves lead settings with live DB lead counts and default lists", async () => {
		mockDb.organization.findUnique.mockResolvedValueOnce({
			id: "ws-1",
			slug: "gisul-tech",
			name: "Gisul Technologies",
			metadata: JSON.stringify({
				leadSettings: {
					defaultOwnerId: "u-owner-1",
				},
			}),
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const settings = await service.leadSettings("u-owner-1");

		expect(settings.sources).toHaveLength(6);
		const websiteSource = settings.sources.find((s) => s.id === "website");
		expect(websiteSource?.name).toBe("Website");
		expect(websiteSource?.type).toBe("online");
		expect(websiteSource?.leadsCount).toBe(124);

		expect(settings.fields.length).toBeGreaterThanOrEqual(8);
		const fullNameField = settings.fields.find((f) => f.id === "full-name");
		expect(fullNameField?.required).toBe(true);
		expect(fullNameField?.showInForm).toBe(true);

		expect(settings.statuses).toHaveLength(6);
		expect(settings.statuses[0].name).toBe("New");
		expect(settings.statuses[1].name).toBe("Qualified");

		expect(settings.assignmentRules).toHaveLength(4);
		expect(settings.assignmentRules[0].title).toBe("Assign leads from Website to Sales team");
		expect(settings.assignmentRules[0].enabled).toBe(true);

		expect(settings.defaultOwner.name).toBe("Rahul Kumar");
		expect(settings.defaultOwner.role).toBe("Sales Manager");
	});

	it("creates, updates, and deletes a custom lead source", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			metadata: "{}",
		});
		mockDb.organization.update.mockResolvedValue({});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const created = await service.createLeadSource("u-1", {
			name: "Trade Shows",
			type: "offline",
		});
		expect(created.id).toBe("trade-shows");
		expect(created.type).toBe("offline");
		expect(created.isCustom).toBe(true);

		const updated = await service.updateLeadSource("u-1", {
			id: "trade-shows",
			status: "inactive",
		});
		expect(updated.status).toBe("inactive");

		const deleted = await service.deleteLeadSource("u-1", { id: "trade-shows" });
		expect(deleted.success).toBe(true);
	});

	it("creates, updates, and deletes custom lead fields and toggle switches", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			metadata: "{}",
		});
		mockDb.organization.update.mockResolvedValue({});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const field = await service.createLeadField("u-1", {
			name: "Estimated Budget",
			type: "dropdown",
			required: true,
			showInForm: true,
		});
		expect(field.id).toBe("estimated-budget");
		expect(field.type).toBe("dropdown");
		expect(field.required).toBe(true);

		const toggled = await service.updateLeadField("u-1", {
			id: "estimated-budget",
			required: false,
			showInForm: false,
		});
		expect(toggled.required).toBe(false);
		expect(toggled.showInForm).toBe(false);

		const deleted = await service.deleteLeadField("u-1", { id: "estimated-budget" });
		expect(deleted.success).toBe(true);
	});

	it("creates, updates, and deletes lead statuses", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			metadata: "{}",
		});
		mockDb.organization.update.mockResolvedValue({});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const status = await service.createLeadStatus("u-1", {
			name: "Demo Completed",
			color: "#8b5cf6",
		});
		expect(status.id).toBe("demo-completed");
		expect(status.color).toBe("#8b5cf6");

		const updated = await service.updateLeadStatus("u-1", {
			id: "demo-completed",
			name: "Demo Scheduled & Completed",
		});
		expect(updated.name).toBe("Demo Scheduled & Completed");

		const deleted = await service.deleteLeadStatus("u-1", { id: "demo-completed" });
		expect(deleted.success).toBe(true);
	});

	it("manages lead assignment rules and default owner", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			metadata: "{}",
		});
		mockDb.organization.update.mockResolvedValue({});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const rule = await service.createLeadAssignmentRule("u-1", {
			title: "Assign Google Ads leads to Marketing Pod",
			description: "Source is Google Ads",
			icon: "link",
			enabled: true,
		});
		expect(rule.title).toBe("Assign Google Ads leads to Marketing Pod");
		expect(rule.enabled).toBe(true);

		const updatedRule = await service.updateLeadAssignmentRule("u-1", {
			id: rule.id,
			enabled: false,
		});
		expect(updatedRule.enabled).toBe(false);

		const deletedRule = await service.deleteLeadAssignmentRule("u-1", { id: rule.id });
		expect(deletedRule.success).toBe(true);

		mockDb.member.findFirst.mockResolvedValueOnce({
			userId: "u-sales-2",
			role: "Sales Executive",
			user: { name: "Priya Mehta", image: null },
		});

		const ownerResult = await service.updateDefaultLeadOwner("u-1", {
			userId: "u-sales-2",
		});
		expect(ownerResult.userId).toBe("u-sales-2");
		expect(ownerResult.name).toBe("Priya Mehta");
	});
});
