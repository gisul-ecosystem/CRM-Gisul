import { DealStage } from "./generated/prisma/enums";

export type DealStageKind = "open" | "won" | "lost";

export type DealStageDefinition = {
	stage: DealStage;
	label: string;
	kind: DealStageKind;
};

export const DEAL_STAGE_CATALOG = [
	{ stage: DealStage.DEMO_BOOKED, label: "New", kind: "open" },
	{ stage: DealStage.QUALIFIED_TO_BUY, label: "Qualified", kind: "open" },
	{
		stage: DealStage.DECISION_MAKER_BOUGHT_IN,
		label: "Proposal",
		kind: "open",
	},
	{ stage: DealStage.CONTRACT_SENT, label: "Negotiation", kind: "open" },
	{ stage: DealStage.CLOSED_WON, label: "Won", kind: "won" },
	{ stage: DealStage.CLOSED_LOST, label: "Lost", kind: "lost" },
	{
		stage: DealStage.UNQUALIFIED_TO_BUY,
		label: "Unqualified",
		kind: "lost",
	},
] as const satisfies readonly DealStageDefinition[];

export type CatalogDealStage = (typeof DEAL_STAGE_CATALOG)[number]["stage"];

const BY_STAGE = Object.fromEntries(
	DEAL_STAGE_CATALOG.map((entry) => [entry.stage, entry]),
) as Record<DealStage, (typeof DEAL_STAGE_CATALOG)[number]>;

export const OPEN_DEAL_STAGES = DEAL_STAGE_CATALOG.filter(
	(entry) => entry.kind === "open",
).map((entry) => entry.stage);

export const CLOSED_DEAL_STAGES = DEAL_STAGE_CATALOG.filter(
	(entry) => entry.kind !== "open",
).map((entry) => entry.stage);

export const LOSING_DEAL_STAGES = DEAL_STAGE_CATALOG.filter(
	(entry) => entry.kind === "lost",
).map((entry) => entry.stage);

export const WON_DEAL_STAGES = DEAL_STAGE_CATALOG.filter(
	(entry) => entry.kind === "won",
).map((entry) => entry.stage);

export function dealStageDefinition(stage: DealStage) {
	return BY_STAGE[stage];
}

export function dealStageLabel(stage: DealStage): string {
	return BY_STAGE[stage].label;
}

export function dealStageKind(stage: DealStage): DealStageKind {
	return BY_STAGE[stage].kind;
}

export function isClosedStage(stage: DealStage): boolean {
	return BY_STAGE[stage].kind !== "open";
}

export function isLosingStage(stage: DealStage): boolean {
	return BY_STAGE[stage].kind === "lost";
}
