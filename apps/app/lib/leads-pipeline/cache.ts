"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import type { LeadFilters, LeadProfile } from "./schemas";

export const pipelineKeys = {
	all: ["leads-pipeline"] as const,
	status: ["leads-pipeline", "status"] as const,
	log: (profile: LeadProfile) => ["leads-pipeline", "log", profile] as const,
	leadsOf: (profile: LeadProfile) =>
		["leads-pipeline", "leads", profile] as const,
	leads: (profile: LeadProfile, filters: LeadFilters, page: number) =>
		["leads-pipeline", "leads", profile, filters, page] as const,
	settings: (profile: LeadProfile) =>
		["leads-pipeline", "settings", profile] as const,
	customSearches: (profile: LeadProfile) =>
		["leads-pipeline", "custom-search", profile] as const,
};

type PipelineCache = {
	run(profile: LeadProfile): Promise<void>;
	everything(): Promise<void>;
};

export function usePipelineCache(): PipelineCache {
	const queryClient = useQueryClient();

	const refresh = (keys: QueryKey[]) =>
		Promise.all(
			keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		).then(() => undefined);

	return {
		run: (profile) =>
			refresh([
				pipelineKeys.status,
				pipelineKeys.log(profile),
				pipelineKeys.leadsOf(profile),
				pipelineKeys.customSearches(profile),
			]),
		everything: () => refresh([pipelineKeys.all]),
	};
}
