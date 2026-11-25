"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { UNIFERS } from "./unifers-config";

export const CAMPAIGN_SENDERS = ["engine", "unifers"] as const;
export type CampaignSender = (typeof CAMPAIGN_SENDERS)[number];

export const CAMPAIGN_SENDER_LABEL = {
	engine: "Outreach Engine",
	unifers: "Unifers",
} as const satisfies Record<CampaignSender, string>;

export function unifersRouteId(id: number): string {
	return `${UNIFERS.routePrefix}${id}`;
}

export function useCampaignSender() {
	return useQueryState(
		"sender",
		parseAsStringLiteral(CAMPAIGN_SENDERS).withDefault("engine"),
	);
}
