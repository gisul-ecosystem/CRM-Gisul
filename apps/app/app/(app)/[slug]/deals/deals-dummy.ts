import { DealStage } from "@crm/db/enums";

export const STAGE_COLORS: Record<DealStage, string> = {
	DEMO_BOOKED: "#9aa0b4",
	QUALIFIED_TO_BUY: "#8a4fd0",
	DECISION_MAKER_BOUGHT_IN: "#4a63d6",
	CONTRACT_SENT: "#e0a21a",
	CLOSED_WON: "#1a9b6a",
	CLOSED_LOST: "#e0455a",
	UNQUALIFIED_TO_BUY: "#c45c6a",
};
