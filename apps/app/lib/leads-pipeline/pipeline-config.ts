const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export const LEADS_PIPELINE = {
	proxy: {
		crmPrefix: "/api/leads-pipeline",
		upstreamPrefix: "/api",
	},
	refresh: {
		runningMs: 5 * SECOND_MS,
		idleMs: 30 * SECOND_MS,
		listMs: MINUTE_MS,
	},
	logLines: 80,
	pageSize: 25,
	searchDebounceMs: 300,
	defaultProfile: "gpu",
	addToCrm: { maxLeads: 200, defaultLeadSource: "COLD_OUTREACH" },
} as const;
