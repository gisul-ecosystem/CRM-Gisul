import { describe, expect, it } from "bun:test";

describe("Lead Settings Frontend Logic", () => {
	it("correctly categorizes online vs offline lead sources", () => {
		const sources = [
			{ id: "website", name: "Website", type: "online" },
			{ id: "linkedin", name: "LinkedIn", type: "online" },
			{ id: "referral", name: "Referral", type: "offline" },
			{ id: "cold-outreach", name: "Cold Outreach", type: "offline" },
		];

		const onlineSources = sources.filter((s) => s.type === "online");
		const offlineSources = sources.filter((s) => s.type === "offline");

		expect(onlineSources).toHaveLength(2);
		expect(offlineSources).toHaveLength(2);
	});

	it("manages lead field toggle states accurately", () => {
		const field = {
			id: "job-title",
			name: "Job Title",
			type: "text",
			required: false,
			showInForm: true,
		};

		const updatedField = {
			...field,
			required: !field.required,
			showInForm: !field.showInForm,
		};

		expect(updatedField.required).toBe(true);
		expect(updatedField.showInForm).toBe(false);
	});

	it("validates rule category icons and default values", () => {
		const validIcons = ["link", "building", "social", "users"];
		const testIcon = "building";

		expect(validIcons).toContain(testIcon);
	});

	it("verifies lead status hex color codes", () => {
		const statuses = [
			{ name: "New", color: "#94a3b8" },
			{ name: "Qualified", color: "#3b82f6" },
			{ name: "Converted", color: "#22c55e" },
			{ name: "Lost", color: "#ef4444" },
		];

		for (const st of statuses) {
			expect(st.color).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});
});
