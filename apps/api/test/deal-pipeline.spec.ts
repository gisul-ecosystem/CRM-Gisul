import { describe, expect, it } from "bun:test";
import { type Db, type DealStage, Prisma } from "@crm/db";
import type { ConversionService } from "../src/currency/conversion.service";
import { DealsService } from "../src/deals/deals.service";

type StoredStage = {
	stage: DealStage;
	name: string;
	probability: number;
	color: string;
	position: number;
	active: boolean;
};

type StoredSettings = Partial<{
	pipelineProbabilityTracking: boolean;
	pipelineRequireStageNotes: boolean;
	pipelineAutoAssignDeals: boolean;
	pipelineDefaultStage: DealStage;
	pipelineApplyToAllProducts: boolean;
	pipelineAllowSkippingStages: boolean;
}>;

function buildService(role: "owner" | "member" = "owner") {
	const stages: StoredStage[] = [
		{
			stage: "DEMO_BOOKED",
			name: "Discovery",
			probability: 10,
			color: "#9aa0b4",
			position: 1,
			active: true,
		},
	];
	let settings: StoredSettings | null = null;

	const db = {
		member: {
			async findUnique() {
				return { role };
			},
		},
		deal: {
			async groupBy() {
				return [
					{
						stage: "DEMO_BOOKED",
						_count: { _all: 12 },
						_sum: { baseAmount: new Prisma.Decimal("12500.00") },
					},
					{
						stage: "CLOSED_WON",
						_count: { _all: 3 },
						_sum: { baseAmount: new Prisma.Decimal("900.00") },
					},
				];
			},
		},
		pipelineStage: {
			async findMany() {
				return stages;
			},
			async upsert(args: {
				where: { stage: DealStage };
				create: StoredStage;
				update: Partial<StoredStage>;
			}) {
				const existing = stages.find((row) => row.stage === args.where.stage);
				if (existing) {
					for (const [key, value] of Object.entries(args.update)) {
						if (value !== undefined) Object.assign(existing, { [key]: value });
					}
				} else {
					stages.push({ ...args.create });
				}
				return args.create;
			},
		},
		appSetting: {
			async findUnique() {
				return settings;
			},
			async upsert(args: { update: StoredSettings }) {
				const next: StoredSettings = { ...settings };
				for (const [key, value] of Object.entries(args.update)) {
					if (value !== undefined) Object.assign(next, { [key]: value });
				}
				settings = next;
				return settings;
			},
		},
	} as unknown as Db;

	const conversion = {
		async reportingCurrency() {
			return "INR";
		},
	} as unknown as ConversionService;

	return new DealsService(
		db,
		{} as never,
		{} as never,
		conversion,
		{} as never,
	);
}

describe("Deal pipeline", () => {
	it("shows all seven real stages with stored names and live totals", async () => {
		const service = buildService();
		const overview = await service.pipelineOverview("user-1");

		expect(overview.stages).toHaveLength(7);
		expect(overview.stats).toEqual({
			totalStages: 7,
			activeStages: 4,
			closedWon: 1,
			closedLost: 2,
		});
		expect(overview.canManage).toBe(true);

		const first = overview.stages.find(
			(stage) => stage.stage === "DEMO_BOOKED",
		);
		expect(first?.name).toBe("Discovery");
		expect(first?.dealCount).toBe(12);
		expect(first?.totalValueCents).toBe(1_250_000);

		const unqualified = overview.stages.find(
			(stage) => stage.stage === "UNQUALIFIED_TO_BUY",
		);
		expect(unqualified?.status).toBe("lost");
	});

	it("saves pipeline settings to the database", async () => {
		const service = buildService();
		const updated = await service.updatePipelineSettings("user-1", {
			requireStageUpdateNotes: false,
			defaultStage: "QUALIFIED_TO_BUY",
		});

		expect(updated.requireStageUpdateNotes).toBe(false);
		expect(updated.defaultStage).toBe("QUALIFIED_TO_BUY");
		expect(updated.enableProbabilityTracking).toBe(true);
	});

	it("saves a stage edit and keeps it on the next read", async () => {
		const service = buildService();
		const updated = await service.updatePipelineStage("user-1", {
			id: "CONTRACT_SENT",
			name: "Contract out",
			probability: 75,
			active: false,
		});

		expect(updated.name).toBe("Contract out");
		expect(updated.status).toBe("inactive");

		const overview = await service.pipelineOverview("user-1");
		const stage = overview.stages.find((row) => row.stage === "CONTRACT_SENT");
		expect(stage?.probability).toBe(75);
	});

	it("refuses pipeline changes from a member", async () => {
		const service = buildService("member");

		await expect(
			service.updatePipelineSettings("user-2", { autoAssignDeals: true }),
		).rejects.toThrow("Only an owner or an admin can change the pipeline.");
	});
});
