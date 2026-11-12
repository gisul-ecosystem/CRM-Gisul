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
	posts: {
		defaultMaxPosts: 30,
		maxPosts: 100,
		maxKeywordChars: 300,
		defaultDatePosted: "past-week",
		suggestions: [
			"virtual labs for training",
			"cloud labs",
			"hands-on labs",
			"GPU for AI training",
			"AI compute",
			"bare metal servers",
			"corporate upskilling program",
			"AI literacy training",
			"technical assessment platform",
			"AI interview tool",
		],
	},
} as const;
