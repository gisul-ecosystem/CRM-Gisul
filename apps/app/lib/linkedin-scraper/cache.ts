"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";

export const scraperKeys = {
	all: ["linkedin-scraper"] as const,
	status: ["linkedin-scraper", "status"] as const,
	connectionTypes: ["linkedin-scraper", "connection-types"] as const,
	products: ["linkedin-scraper", "products"] as const,
	jobs: ["linkedin-scraper", "jobs"] as const,
	profiles: ["linkedin-scraper", "profiles"] as const,
	queue: ["linkedin-scraper", "queue"] as const,
	sent: (date: string) => ["linkedin-scraper", "sent", date] as const,
};

export type ScraperCache = {
	status(): Promise<void>;
	scrape(): Promise<void>;
	queue(): Promise<void>;
	everything(): Promise<void>;
};

export function useScraperCache(): ScraperCache {
	const queryClient = useQueryClient();

	const run = (keys: QueryKey[]) =>
		Promise.all(
			keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		).then(() => undefined);

	return {
		status: () => run([scraperKeys.status]),
		scrape: () =>
			run([
				scraperKeys.status,
				scraperKeys.jobs,
				scraperKeys.profiles,
				scraperKeys.queue,
			]),
		queue: () =>
			run([scraperKeys.status, scraperKeys.queue, scraperKeys.profiles]),
		everything: () => run([scraperKeys.all]),
	};
}
