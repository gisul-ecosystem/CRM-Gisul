"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { LeadEvent } from "./schemas";

export const unifersKeys = {
	all: ["unifers"] as const,
	accounts: ["unifers", "accounts"] as const,
	campaigns: (offset: number) => ["unifers", "campaigns", offset] as const,
	openCampaigns: ["unifers", "campaigns", "open"] as const,
	overviewCampaigns: ["unifers", "campaigns", "overview"] as const,
	analytics: (id: number) => ["unifers", "analytics", id] as const,
	leads: (id: number, event: LeadEvent, offset: number) =>
		["unifers", "leads", id, event, offset] as const,
	replies: ["unifers", "replies"] as const,
	leadReply: (email: string) => ["unifers", "replies", "lead", email] as const,
	thread: (mailbox: string, messageId: string) =>
		["unifers", "replies", "thread", mailbox, messageId] as const,
};

export function useUnifersCache(): { everything(): Promise<void> } {
	const queryClient = useQueryClient();
	return {
		everything: () =>
			queryClient.invalidateQueries({ queryKey: unifersKeys.all }),
	};
}
