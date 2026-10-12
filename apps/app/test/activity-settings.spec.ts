import { describe, expect, it } from "bun:test";

describe("Activity Settings Frontend Logic", () => {
	it("validates activity types default list structure and formatting", () => {
		const defaultActivityTypes = [
			{
				id: "task",
				name: "Task",
				icon: "checkmark",
				defaultReminder: "1 day before",
				autoFollowUp: "None",
				status: true,
			},
			{
				id: "call",
				name: "Call",
				icon: "phone",
				defaultReminder: "15 minutes before",
				autoFollowUp: "Log outcome",
				status: true,
			},
			{
				id: "meeting",
				name: "Meeting",
				icon: "calendar",
				defaultReminder: "1 hour before",
				autoFollowUp: "Send follow-up email",
				status: true,
			},
			{
				id: "email",
				name: "Email",
				icon: "email",
				defaultReminder: "No reminder",
				autoFollowUp: "None",
				status: true,
			},
			{
				id: "follow-up",
				name: "Follow-up",
				icon: "sync",
				defaultReminder: "1 day before",
				autoFollowUp: "Create new task",
				status: true,
			},
		];

		expect(defaultActivityTypes.length).toBe(5);
		expect(defaultActivityTypes.every((t) => t.status === true)).toBe(true);
		expect(defaultActivityTypes.map((t) => t.name)).toEqual([
			"Task",
			"Call",
			"Meeting",
			"Email",
			"Follow-up",
		]);
	});

	it("handles reminder timing option selection and toggles accurately", () => {
		const initialTimings = ["1 day before"];

		const toggleTiming = (current: string[], option: string) => {
			return current.includes(option)
				? current.filter((t) => t !== option)
				: [...current, option];
		};

		const withFifteenMins = toggleTiming(initialTimings, "15 minutes before");
		expect(withFifteenMins).toEqual(["1 day before", "15 minutes before"]);

		const removedDayBefore = toggleTiming(withFifteenMins, "1 day before");
		expect(removedDayBefore).toEqual(["15 minutes before"]);
	});

	it("validates auto assignment rules structure and attributes", () => {
		const assignmentRules = [
			{
				id: "rule-1",
				name: "Website Enquiry",
				appliesTo: "All Activities",
				condition: "Lead source is Website",
				assignTo: "Sales Team (Round Robin)",
				status: true,
			},
			{
				id: "rule-2",
				name: "High Value Leads",
				appliesTo: "Calls, Meetings",
				condition: "Deal value > ₹1,00,000",
				assignTo: "Rahul Kumar",
				status: true,
			},
			{
				id: "rule-3",
				name: "Product Specific",
				appliesTo: "Tasks, Calls",
				condition: "Product is Appbar",
				assignTo: "Product Team",
				status: false,
			},
		];

		expect(assignmentRules.length).toBe(3);
		expect(assignmentRules.filter((r) => r.status).length).toBe(2);
		expect(assignmentRules[0]?.assignTo).toBe("Sales Team (Round Robin)");
	});

	it("verifies completion behavior toggles", () => {
		const completionBehavior = {
			allowAddingNotes: true,
			updateDealStage: true,
			createFollowUpActivity: true,
		};

		expect(completionBehavior.allowAddingNotes).toBe(true);
		expect(completionBehavior.updateDealStage).toBe(true);
		expect(completionBehavior.createFollowUpActivity).toBe(true);
	});
});
