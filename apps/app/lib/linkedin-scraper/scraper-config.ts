const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export const LINKEDIN_SCRAPER = {
	proxy: {
		crmPrefix: "/api/linkedin-scraper",
		upstreamPrefix: "/api",
	},
	refresh: {
		activeJobMs: 3 * SECOND_MS,
		idleMs: 30 * SECOND_MS,
		listMs: MINUTE_MS,
	},
	health: {
		staleMs: MINUTE_MS,
	},
	logLines: 40,
	pageSize: 25,
	searchDebounceMs: 300,
	scrape: {
		defaultMaxResults: 50,
		maxResults: 2000,
		historyLimit: 20,
	},
} as const;
