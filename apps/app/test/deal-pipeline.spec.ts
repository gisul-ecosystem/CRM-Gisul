import { describe, expect, it } from "vitest";

describe("Deal Pipeline Visual & Stats Computations", () => {
	const mockStages = [
		{
			id: "stage-1",
			stage: "DEMO_BOOKED",
			name: "Qualification",
			probability: 10,
			color: "#6C5CE7",
			kind: "open" as const,
			status: "active" as const,
			dealCount: 12,
			totalValueCents: 1250000,
		},
		{
			id: "stage-2",
			stage: "QUALIFIED_TO_BUY",
			name: "Needs Analysis",
			probability: 30,
			color: "#3B82F6",
			kind: "open" as const,
			status: "active" as const,
			dealCount: 8,
			totalValueCents: 820000,
		},
		{
			id: "stage-3",
			stage: "DECISION_MAKER_BOUGHT_IN",
			name: "Proposal",
			probability: 50,
			color: "#F59E0B",
			kind: "open" as const,
			status: "active" as const,
			dealCount: 6,
			totalValueCents: 1430000,
		},
		{
			id: "stage-4",
			stage: "CONTRACT_SENT",
			name: "Negotiation",
			probability: 80,
			color: "#F97316",
			kind: "open" as const,
			status: "active" as const,
			dealCount: 4,
			totalValueCents: 900000,
		},
		{
			id: "stage-5",
			stage: "CLOSED_WON",
			name: "Closed Won",
			probability: 100,
			color: "#10B981",
			kind: "won" as const,
			status: "won" as const,
			dealCount: 16,
			totalValueCents: 3240000,
		},
		{
			id: "stage-6",
			stage: "CLOSED_LOST",
			name: "Closed Lost",
			probability: 0,
			color: "#EF4444",
			kind: "lost" as const,
			status: "lost" as const,
			dealCount: 7,
			totalValueCents: 610000,
		},
	];

	it("computes active, won, and lost stage totals correctly", () => {
		const totalStages = mockStages.length;
		const activeStages = mockStages.filter((s) => s.kind === "open" && s.status === "active").length;
		const closedWon = mockStages.filter((s) => s.kind === "won").length;
		const closedLost = mockStages.filter((s) => s.kind === "lost").length;

		expect(totalStages).toBe(6);
		expect(activeStages).toBe(4);
		expect(closedWon).toBe(1);
		expect(closedLost).toBe(1);
	});

	it("calculates total pipeline volume across active stages", () => {
		const activeStages = mockStages.filter((s) => s.kind === "open");
		const totalActiveDeals = activeStages.reduce((acc, s) => acc + s.dealCount, 0);
		const totalActiveValueCents = activeStages.reduce((acc, s) => acc + s.totalValueCents, 0);

		expect(totalActiveDeals).toBe(30);
		expect(totalActiveValueCents).toBe(4400000);
	});

	it("calculates weighted pipeline value based on win probabilities", () => {
		const weightedValueCents = mockStages.reduce(
			(acc, s) => acc + (s.totalValueCents * s.probability) / 100,
			0,
		);

		// Qualification: 1250000 * 0.10 = 125000
		// Needs Analysis: 820000 * 0.30 = 246000
		// Proposal: 1430000 * 0.50 = 715000
		// Negotiation: 900000 * 0.80 = 720000
		// Closed Won: 3240000 * 1.00 = 3240000
		// Closed Lost: 610000 * 0.00 = 0
		// Total = 5046000
		expect(weightedValueCents).toBe(5046000);
	});
});
