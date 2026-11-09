"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { pipelineApi } from "./api";
import { pipelineKeys } from "./cache";
import { LEADS_PIPELINE } from "./pipeline-config";
import { LEAD_PROFILES, type PipelineStatus } from "./schemas";

function anyRunning(status: PipelineStatus | undefined): boolean {
	return status?.profiles.some((profile) => profile.running) ?? false;
}

export function usePipelineStatus() {
	return useQuery({
		queryKey: pipelineKeys.status,
		queryFn: () => pipelineApi.status(),
		retry: false,
		refetchInterval: (query) =>
			anyRunning(query.state.data)
				? LEADS_PIPELINE.refresh.runningMs
				: LEADS_PIPELINE.refresh.idleMs,
	});
}

export function useLeadProfile() {
	return useQueryState(
		"profile",
		parseAsStringLiteral(LEAD_PROFILES).withDefault(
			LEADS_PIPELINE.defaultProfile,
		),
	);
}
