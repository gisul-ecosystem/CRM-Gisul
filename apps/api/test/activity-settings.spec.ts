import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../src/workspace/workspace.service";

describe("WorkspaceService Activity Settings", () => {
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
						name: "Rahul Kumar",
						email: "rahul@example.com",
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

	it("retrieves default activity settings with 5 base activity types and rules", async () => {
		mockDb.organization.findUnique.mockResolvedValueOnce({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const result = await service.activitySettings("u-1");

		expect(result.activityTypes.length).toBe(5);
		expect(result.activityTypes[0]?.name).toBe("Task");
		expect(result.activityTypes[1]?.name).toBe("Call");
		expect(result.activityTypes[2]?.name).toBe("Meeting");
		expect(result.activityTypes[3]?.name).toBe("Email");
		expect(result.activityTypes[4]?.name).toBe("Follow-up");

		expect(result.defaultSettings.defaultActivityType).toBe("task");
		expect(result.defaultSettings.defaultDuration).toBe("30 minutes");
		expect(result.defaultSettings.defaultReminderTime).toBe("1 day before");
		expect(result.defaultSettings.addToCalendar).toBe(true);

		expect(result.reminderRules.enableActivityReminders).toBe(true);
		expect(result.reminderRules.emailReminders).toBe(true);
		expect(result.reminderRules.overdueNotifications).toBe(true);

		expect(result.completionBehavior.allowAddingNotes).toBe(true);
		expect(result.completionBehavior.updateDealStage).toBe(true);
		expect(result.completionBehavior.createFollowUpActivity).toBe(true);

		expect(result.assignmentRules.length).toBe(3);
		expect(result.assignmentRules[0]?.name).toBe("Website Enquiry");
	});

	it("creates, updates, and deletes custom activity types", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const created = await service.createActivityType("u-1", {
			name: "Demo Session",
			icon: "presentation",
			iconColor: "#6366f1",
			defaultReminder: "30 minutes before",
			autoFollowUp: "Send follow-up email",
			status: true,
		});

		expect(created.name).toBe("Demo Session");
		expect(created.icon).toBe("presentation");
		expect(created.defaultReminder).toBe("30 minutes before");
		expect(mockDb.organization.update).toHaveBeenCalled();

		// Mock updated metadata
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: JSON.stringify({
				activityTypes: [
					{
						id: created.id,
						name: "Demo Session",
						icon: "presentation",
						iconColor: "#6366f1",
						defaultReminder: "30 minutes before",
						autoFollowUp: "Send follow-up email",
						status: true,
					},
				],
			}),
		});

		const updated = await service.updateActivityType("u-1", {
			id: created.id,
			defaultReminder: "1 hour before",
			status: false,
		});

		expect(updated.defaultReminder).toBe("1 hour before");
		expect(updated.status).toBe(false);

		const deleted = await service.deleteActivityType("u-1", { id: created.id });
		expect(deleted.success).toBe(true);
	});

	it("manages default settings, reminder rules, and completion behavior", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const defaultSettings = await service.updateDefaultActivitySettings("u-1", {
			defaultActivityType: "call",
			defaultDuration: "45 minutes",
			defaultReminderTime: "15 minutes before",
			addToCalendar: false,
		});

		expect(mockDb.organization.update).toHaveBeenCalled();

		const reminders = await service.updateReminderRules("u-1", {
			enableActivityReminders: true,
			emailReminders: false,
			overdueNotifications: true,
			timingOptions: ["15 minutes before", "1 day before"],
		});

		const completion = await service.updateCompletionBehavior("u-1", {
			allowAddingNotes: true,
			updateDealStage: false,
			createFollowUpActivity: true,
		});
	});

	it("creates, updates, and deletes auto assignment rules", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const createdRule = await service.createActivityAssignmentRule("u-1", {
			name: "Enterprise Leads",
			appliesTo: "Meetings",
			condition: "Deal size > ₹5,00,000",
			assignTo: "Senior Executive",
			status: true,
		});

		expect(createdRule.name).toBe("Enterprise Leads");
		expect(createdRule.condition).toBe("Deal size > ₹5,00,000");

		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: JSON.stringify({
				activityAssignmentRules: [createdRule],
			}),
		});

		const updatedRule = await service.updateActivityAssignmentRule("u-1", {
			id: createdRule.id,
			status: false,
		});

		expect(updatedRule.status).toBe(false);

		const deleted = await service.deleteActivityAssignmentRule("u-1", {
			id: createdRule.id,
		});
		expect(deleted.success).toBe(true);
	});
});
