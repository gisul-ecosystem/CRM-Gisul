import { describe, expect, it, vi } from "vitest";
import { DealsService } from "../src/deals/deals.service";

describe("Deal Pipeline Service", () => {
	const mockDb = {
		deal: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			count: vi.fn().mockResolvedValue(3),
			groupBy: vi.fn().mockResolvedValue([
				{ stage: "DEMO_BOOKED", _count: { _all: 12 }, _sum: { baseAmount: "12500.00" } },
				{ stage: "QUALIFIED_TO_BUY", _count: { _all: 8 }, _sum: { baseAmount: "8200.00" } },
				{ stage: "CLOSED_WON", _count: { _all: 16 }, _sum: { baseAmount: "32400.00" } },
				{ stage: "CLOSED_LOST", _count: { _all: 7 }, _sum: { baseAmount: "6100.00" } },
			]),
			aggregate: vi.fn(),
			update: vi.fn(),
		},
		product: {
			findMany: vi.fn().mockResolvedValue([]),
		},
	} as any;

	const mockAgent = {} as any;
	const mockStamp = {} as any;
	const mockConversion = {
		reportingCurrency: vi.fn().mockResolvedValue("INR"),
		countedWhere: vi.fn().mockReturnValue({}),
	} as any;
	const mockFields = {
		filterableFieldsFor: vi.fn().mockResolvedValue([]),
	} as any;

	const service = new DealsService(
		mockDb,
		mockAgent,
		mockStamp,
		mockConversion,
		mockFields,
	);

	it("retrieves pipeline overview with aggregated real stats and stage metrics", async () => {
		const overview = await service.pipelineOverview("user-1");

		expect(overview.currency).toBe("INR");
		expect(overview.stats.totalStages).toBe(6);
		expect(overview.stats.activeStages).toBe(4);
		expect(overview.stats.closedWon).toBe(1);
		expect(overview.stats.closedLost).toBe(1);

		const demoBooked = overview.stages.find((s) => s.stage === "DEMO_BOOKED");
		expect(demoBooked).toBeDefined();
		expect(demoBooked?.name).toBe("Qualification");
		expect(demoBooked?.dealCount).toBe(12);
		expect(demoBooked?.totalValueCents).toBe(1250000);
	});

	it("updates pipeline settings and toggles", async () => {
		const updated = await service.updatePipelineSettings("user-1", {
			enableProbabilityTracking: true,
			requireStageUpdateNotes: false,
			autoAssignDeals: true,
			defaultStage: "QUALIFIED_TO_BUY",
		});

		expect(updated.requireStageUpdateNotes).toBe(false);
		expect(updated.autoAssignDeals).toBe(true);
		expect(updated.defaultStage).toBe("QUALIFIED_TO_BUY");
	});

	it("creates a new custom pipeline stage", async () => {
		const created = await service.createPipelineStage("user-1", {
			name: "Contract Review",
			probability: 85,
			color: "#8B5CF6",
			kind: "open",
			status: "active",
		});

		expect(created.name).toBe("Contract Review");
		expect(created.probability).toBe(85);
		expect(created.color).toBe("#8B5CF6");
		expect(created.dealCount).toBe(0);
	});

	it("updates an existing pipeline stage name and probability", async () => {
		const updated = await service.updatePipelineStage("user-1", {
			id: "stage-1",
			name: "Initial Discovery",
			probability: 15,
			color: "#6C5CE7",
		});

		expect(updated.name).toBe("Initial Discovery");
		expect(updated.probability).toBe(15);
	});

	it("deletes a pipeline stage", async () => {
		const deleted = await service.deletePipelineStage("user-1", "stage-2");
		expect(deleted.id).toBe("stage-2");

		const overview = await service.pipelineOverview("user-1");
		expect(overview.stages.find((s) => s.id === "stage-2")).toBeUndefined();
	});
});
