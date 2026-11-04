"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";

export const outreachKeys = {
	all: ["outreach"] as const,
	dashboard: ["outreach", "dashboard"] as const,
	campaigns: ["outreach", "campaigns"] as const,
	campaign: (id: string) => ["outreach", "campaigns", id] as const,
	audience: ["outreach", "audience"] as const,
	contacts: ["outreach", "audience", "contacts"] as const,
	lists: ["outreach", "audience", "lists"] as const,
	suppressions: ["outreach", "audience", "suppressions"] as const,
	sent: ["outreach", "sent"] as const,
	replies: ["outreach", "replies"] as const,
	tracking: ["outreach", "tracking"] as const,
	sending: ["outreach", "sending"] as const,
	domains: ["outreach", "sending", "domains"] as const,
	inboxes: ["outreach", "sending", "inboxes"] as const,
	providers: ["outreach", "sending", "providers"] as const,
};

export type OutreachCache = {
	campaigns(id?: string): Promise<void>;
	audience(): Promise<void>;
	sending(): Promise<void>;
	everything(): Promise<void>;
};

export function useOutreachCache(): OutreachCache {
	const queryClient = useQueryClient();

	const run = (keys: QueryKey[]) =>
		Promise.all(
			keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		).then(() => undefined);

	return {
		campaigns: (id) =>
			run([
				id ? outreachKeys.campaign(id) : outreachKeys.campaigns,
				outreachKeys.campaigns,
				outreachKeys.dashboard,
			]),
		audience: () =>
			run([
				outreachKeys.audience,
				outreachKeys.campaigns,
				outreachKeys.dashboard,
			]),
		sending: () =>
			run([
				outreachKeys.sending,
				outreachKeys.dashboard,
				outreachKeys.campaigns,
			]),
		everything: () => run([outreachKeys.all]),
	};
}
