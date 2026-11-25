import type { PartnerRow } from "@/lib/leads-pipeline/partner-schemas";

export const ALL_RUNS = "all";
export const ANY = "any";

export const PARTNER_SORTS = [
	{ value: "score", label: "Best match" },
	{ value: "newest", label: "Newest signal" },
	{ value: "value", label: "Biggest contract" },
	{ value: "sizeAsc", label: "Smallest company" },
	{ value: "sizeDesc", label: "Largest company" },
	{ value: "contacts", label: "Most contacts" },
	{ value: "name", label: "Company A–Z" },
	{ value: "country", label: "Country" },
] as const;

export type PartnerSort = (typeof PARTNER_SORTS)[number]["value"];

export const PARTNER_SIZE_FILTERS = [
	{ value: ANY, label: "Any size" },
	{ value: "yes", label: "Size fits" },
	{ value: "maybe", label: "Size partly fits" },
	{ value: "unknown", label: "Size unknown" },
] as const;

export type PartnerSizeFilter = (typeof PARTNER_SIZE_FILTERS)[number]["value"];

export const PARTNER_CONTACT_FILTERS = [
	{ value: ANY, label: "Any contacts" },
	{ value: "person", label: "Has a contact" },
	{ value: "reachable", label: "Has email or phone" },
	{ value: "none", label: "No contact yet" },
] as const;

export type PartnerContactFilter =
	(typeof PARTNER_CONTACT_FILTERS)[number]["value"];

export type PartnerView = {
	sort: PartnerSort;
	country: string;
	size: PartnerSizeFilter;
	contacts: PartnerContactFilter;
	search: string;
};

export const DEFAULT_PARTNER_VIEW: PartnerView = {
	sort: "score",
	country: ANY,
	size: ANY,
	contacts: ANY,
	search: "",
};

const SIZE_LABEL = /([\d,]+)\s*(?:-\s*([\d,]+)|(\+))?\s*employees/i;

function count(text: string | undefined): number | null {
	if (!text) return null;
	const value = Number(text.replace(/,/g, ""));
	return Number.isFinite(value) ? value : null;
}

export function sizeRange(row: PartnerRow): {
	low: number | null;
	high: number | null;
} {
	if (row.sizeLow !== null) return { low: row.sizeLow, high: row.sizeHigh };
	const match = SIZE_LABEL.exec(row.size);
	if (!match) return { low: null, high: null };
	const low = count(match[1]);
	return { low, high: match[3] ? null : (count(match[2]) ?? low) };
}

function reachable(row: PartnerRow): boolean {
	return row.people.some((person) => person.email || person.phone);
}

function matchesSearch(row: PartnerRow, search: string): boolean {
	const needle = search.trim().toLowerCase();
	if (!needle) return true;
	const haystack = [
		row.company,
		row.domain,
		row.country,
		...row.agencies,
		...row.people.map((person) => person.name),
		...row.evidence.map((item) => item.title),
	]
		.join(" ")
		.toLowerCase();
	return haystack.includes(needle);
}

function keep(row: PartnerRow, view: PartnerView): boolean {
	if (view.country !== ANY && row.country !== view.country) return false;
	if (view.size !== ANY && row.sizeFit !== view.size) return false;
	if (view.contacts === "person" && row.people.length === 0) return false;
	if (view.contacts === "reachable" && !reachable(row)) return false;
	if (view.contacts === "none" && row.people.length > 0) return false;
	return matchesSearch(row, view.search);
}

function sizeKey(row: PartnerRow, missing: number): number {
	return sizeRange(row).low ?? missing;
}

const COMPARE: {
	[sort in PartnerSort]: (a: PartnerRow, b: PartnerRow) => number;
} = {
	score: (a, b) => b.score - a.score,
	newest: (a, b) => b.date.localeCompare(a.date),
	value: (a, b) => b.valueUsd - a.valueUsd,
	sizeAsc: (a, b) =>
		sizeKey(a, Number.POSITIVE_INFINITY) - sizeKey(b, Number.POSITIVE_INFINITY),
	sizeDesc: (a, b) => sizeKey(b, -1) - sizeKey(a, -1),
	contacts: (a, b) =>
		Number(reachable(b)) - Number(reachable(a)) ||
		b.people.length - a.people.length,
	name: (a, b) => a.company.localeCompare(b.company),
	country: (a, b) => a.country.localeCompare(b.country),
};

export function viewRows(rows: PartnerRow[], view: PartnerView): PartnerRow[] {
	const compare = COMPARE[view.sort];
	return rows
		.filter((row) => keep(row, view))
		.sort((a, b) => compare(a, b) || b.score - a.score);
}

export function viewSummary(rows: PartnerRow[]) {
	return {
		withContacts: rows.filter((row) => row.people.length > 0).length,
		reachable: rows.filter(reachable).length,
	};
}

export function countryOptions(rows: PartnerRow[]) {
	const countries = [...new Set(rows.map((row) => row.country))].sort();
	return [
		{ value: ANY, label: "All countries" },
		...countries.map((country) => ({ value: country, label: country })),
	];
}
