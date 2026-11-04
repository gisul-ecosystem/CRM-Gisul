"use client";

import { useQuery } from "@tanstack/react-query";
import { scraperApi } from "./api";
import { scraperKeys } from "./cache";
import type { ScraperStatus } from "./schemas";
import { LINKEDIN_SCRAPER } from "./scraper-config";

export function anyJobRunning(status: ScraperStatus | undefined): boolean {
	if (!status) return false;
	return [status.linkedInJob, status.scrapeJob, status.sendJob].some(
		(job) => job.status === "running",
	);
}

export function useScraperStatus() {
	return useQuery({
		queryKey: scraperKeys.status,
		queryFn: () => scraperApi.status(),
		retry: false,
		refetchInterval: (query) =>
			anyJobRunning(query.state.data)
				? LINKEDIN_SCRAPER.refresh.activeJobMs
				: LINKEDIN_SCRAPER.refresh.idleMs,
	});
}
