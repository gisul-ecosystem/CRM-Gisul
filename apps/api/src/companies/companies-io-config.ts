const KB = 1024;
const MB = 1024 * KB;

export const COMPANY_IO = {
	export: { maxRows: 10_000 },
	import: { maxRows: 2_000, maxBytes: 2 * MB },
	headers: [
		"name",
		"domain",
		"ownerEmail",
		"industry",
		"website",
		"phone",
		"email",
	] as const,
} as const;

export type CompanyCsvHeader = (typeof COMPANY_IO.headers)[number];
