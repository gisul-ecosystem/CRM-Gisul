import {
	DEAL_STAGE_CATALOG,
	dealStageLabel as catalogLabel,
	isClosedStage as catalogIsClosed,
	LOSING_DEAL_STAGES,
	OPEN_DEAL_STAGES,
} from "@crm/db/deal-stage";
import { DealStage } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

const TONE: Record<DealStage, StatusTone> = {
	DEMO_BOOKED: "neutral",
	QUALIFIED_TO_BUY: "info",
	DECISION_MAKER_BOUGHT_IN: "info",
	CONTRACT_SENT: "warning",
	CLOSED_WON: "success",
	CLOSED_LOST: "error",
	UNQUALIFIED_TO_BUY: "neutral",
};

export const OPEN_STAGES = OPEN_DEAL_STAGES;

export const LOSING_STAGES = LOSING_DEAL_STAGES;

export const DEAL_STAGE_OPTIONS = DEAL_STAGE_CATALOG.map((entry) => ({
	value: entry.stage,
	label: entry.label,
}));

const OPEN_STAGE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
] as const;

export function isClosedStage(stage: DealStage): boolean {
	return catalogIsClosed(stage);
}

export function dealStageColor(stage: DealStage): string {
	const index = OPEN_STAGES.indexOf(stage);
	return OPEN_STAGE_COLORS[index] ?? "var(--chart-5)";
}

export function dealStageLabel(stage: DealStage): string {
	return catalogLabel(stage);
}

export function dealStagePresentation(stage: DealStage) {
	return {
		label: catalogLabel(stage),
		tone: TONE[stage],
	};
}
