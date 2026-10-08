import { describe, expect, it } from "vitest";

describe("Products filtering and sorting logic", () => {
	const mockProducts = [
		{
			id: "prod-1",
			name: "Aaptor",
			shortDescription: "AI-powered capability assessment and development platform",
			status: "ACTIVE" as const,
			counts: { leads: 124, deals: 36, customers: 18 },
			createdAt: "2026-01-01T00:00:00.000Z",
		},
		{
			id: "prod-2",
			name: "Racko",
			shortDescription: "Cloud infrastructure platform for virtual machines",
			status: "ACTIVE" as const,
			counts: { leads: 80, deals: 45, customers: 20 },
			createdAt: "2026-01-02T00:00:00.000Z",
		},
		{
			id: "prod-3",
			name: "Kanonkode",
			shortDescription: "Learning and workforce development platform",
			status: "INACTIVE" as const,
			counts: { leads: 50, deals: 10, customers: 5 },
			createdAt: "2026-01-03T00:00:00.000Z",
		},
	];

	it("filters products by search query in name and description", () => {
		const q = "cloud";
		const filtered = mockProducts.filter(
			(p) =>
				p.name.toLowerCase().includes(q.toLowerCase()) ||
				p.shortDescription.toLowerCase().includes(q.toLowerCase()),
		);
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.name).toBe("Racko");
	});

	it("filters products by status", () => {
		const active = mockProducts.filter((p) => p.status === "ACTIVE");
		const inactive = mockProducts.filter((p) => p.status === "INACTIVE");
		expect(active).toHaveLength(2);
		expect(inactive).toHaveLength(1);
	});

	it("sorts products by name, leads, and deals", () => {
		const sortedByName = [...mockProducts].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		expect(sortedByName.map((p) => p.name)).toEqual([
			"Aaptor",
			"Kanonkode",
			"Racko",
		]);

		const sortedByLeads = [...mockProducts].sort(
			(a, b) => b.counts.leads - a.counts.leads,
		);
		expect(sortedByLeads[0]?.name).toBe("Aaptor");

		const sortedByDeals = [...mockProducts].sort(
			(a, b) => b.counts.deals - a.counts.deals,
		);
		expect(sortedByDeals[0]?.name).toBe("Racko");
	});
});
