const KB = 1024;
const MB = 1024 * KB;

export const DAY_MS = 24 * 60 * 60_000;

export const MEMBERS = {
	activeWithinDays: 30,
} as const;

export const DATA_MANAGEMENT = {
	transfers: { windowDays: 30, recentLimit: 5 },
	import: { maxBytes: 10 * MB },
	backups: { listLimit: 20, maxRecordsPerType: 50_000 },
	purge: { maxRounds: 20 },
	duplicates: { maxGroups: 50 },
} as const;
