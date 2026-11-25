const KB = 1024;
const MB = 1024 * KB;

export const DEAL_IO = {
	export: { maxRows: 10_000 },
	import: { maxRows: 2_000, maxBytes: 2 * MB },
	headers: [
		"name",
		"company",
		"ownerEmail",
		"product",
		"stage",
		"amount",
		"currency",
		"expectedCloseDate",
		"closedReason",
	] as const,
} as const;

export type DealCsvHeader = (typeof DEAL_IO.headers)[number];
