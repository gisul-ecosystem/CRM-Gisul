const DAY_MS = 24 * 60 * 60 * 1000;

export const OUTREACH = {
	session: {
		cookieName: "outreach_session",
		loginPath: "/api/auth/login",
		reuseMs: 6 * DAY_MS,
	},
	proxy: {
		crmPrefix: "/api/outreach",
		enginePrefix: "/api",
	},
	adminOnlyAreas: ["providers", "domains", "inboxes"],
	refresh: {
		dashboardMs: 30_000,
		campaignMs: 15_000,
		listMs: 60_000,
	},
	overview: {
		timelineDays: 14,
		clickersLimit: 10,
	},
	pageSize: 25,
	searchDebounceMs: 300,
} as const;
