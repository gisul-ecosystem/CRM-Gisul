const KB = 1024;
const MB = 1024 * KB;

export const CONTACT_IO = {
	export: { maxRows: 10_000 },
	import: { maxRows: 2_000, maxBytes: 2 * MB },
	headers: [
		"firstName",
		"lastName",
		"email",
		"phone",
		"title",
		"company",
		"ownerEmail",
		"product",
		"leadStatus",
		"leadSource",
		"nextFollowUpAt",
	] as const,
} as const;

export type ContactCsvHeader = (typeof CONTACT_IO.headers)[number];
