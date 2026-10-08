import { describe, expect, it } from "vitest";

describe("Integrations Settings Frontend Logic", () => {
	const mockIntegrations = [
		{
			id: "gmail",
			name: "Gmail",
			category: "communication",
			description: "Sync emails and activities",
			connected: true,
			enabled: true,
		},
		{
			id: "outlook",
			name: "Outlook",
			category: "communication",
			description: "Sync calendar events",
			connected: false,
			enabled: false,
		},
		{
			id: "slack",
			name: "Slack",
			category: "collaboration",
			description: "Share deal updates in Slack",
			connected: true,
			enabled: true,
		},
		{
			id: "hubspot",
			name: "HubSpot",
			category: "marketing",
			description: "Sync contacts and leads",
			connected: false,
			enabled: false,
		},
		{
			id: "api-access",
			name: "API Access",
			category: "development",
			description: "Custom REST and tRPC APIs",
			connected: true,
			enabled: true,
		},
	];

	it("filters integrations accurately by search term", () => {
		const query = "slack";
		const filtered = mockIntegrations.filter(
			(i) =>
				i.name.toLowerCase().includes(query) ||
				i.description.toLowerCase().includes(query),
		);

		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("slack");
	});

	it("filters integrations accurately by category", () => {
		const comms = mockIntegrations.filter((i) => i.category === "communication");
		const collab = mockIntegrations.filter((i) => i.category === "collaboration");
		const mkt = mockIntegrations.filter((i) => i.category === "marketing");
		const dev = mockIntegrations.filter((i) => i.category === "development");

		expect(comms).toHaveLength(2);
		expect(collab).toHaveLength(1);
		expect(mkt).toHaveLength(1);
		expect(dev).toHaveLength(1);
	});

	it("computes summary counts correctly", () => {
		const total = mockIntegrations.length;
		const connected = mockIntegrations.filter((i) => i.connected).length;
		const notConnected = mockIntegrations.filter((i) => !i.connected).length;

		expect(total).toBe(5);
		expect(connected).toBe(3);
		expect(notConnected).toBe(2);
	});
});
