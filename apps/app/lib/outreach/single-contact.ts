import { z } from "zod";
import { customKey } from "./contact-fields";
import type {
	AudienceContact,
	ColumnTarget,
	ImportReport,
} from "./schemas/audience";

export const SINGLE_CONTACT_LIMITS = {
	field: 200,
	sampleSize: 100,
	maxCustom: 30,
} as const;

const field = z.string().trim().max(SINGLE_CONTACT_LIMITS.field);

export const singleContact = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.pipe(z.email({ error: "Give a valid email address." })),
	firstName: field,
	lastName: field,
	company: field,
	title: field,
	custom: z.record(z.string(), field),
});

export type SingleContact = z.infer<typeof singleContact>;

type StandardKey = Exclude<keyof SingleContact, "custom">;

const COLUMNS = [
	["email", "email"],
	["first_name", "firstName"],
	["last_name", "lastName"],
	["company", "company"],
	["title", "title"],
] as const satisfies readonly (readonly [string, StandardKey])[];

const STANDARD_COLUMNS = new Set<string>(COLUMNS.map(([column]) => column));

function cell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function listColumns(contacts: readonly AudienceContact[]): string[] {
	const counts = new Map<string, number>();
	for (const contact of contacts) {
		for (const key of Object.keys(contact.custom)) {
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.filter(([key]) => customKey(key) === key && !STANDARD_COLUMNS.has(key))
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, SINGLE_CONTACT_LIMITS.maxCustom)
		.map(([key]) => key);
}

export function columnLabel(key: string): string {
	const words = key.replace(/_/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function singleContactFile(contact: SingleContact): {
	file: File;
	mapping: { [column: string]: ColumnTarget };
} {
	const cells: [string, string, ColumnTarget][] = [
		...COLUMNS.map(([column, key]): [string, string, ColumnTarget] => [
			column,
			contact[key],
			key,
		]),
		...Object.entries(contact.custom)
			.filter(([key]) => !STANDARD_COLUMNS.has(key))
			.map(([key, value]): [string, string, ColumnTarget] => [
				key,
				value,
				"custom",
			]),
	].filter(([column, value]) => column === "email" || value.trim() !== "");
	const header = cells.map(([column]) => column).join(",");
	const row = cells.map(([, value]) => cell(value)).join(",");
	return {
		file: new File([`${header}\r\n${row}\r\n`], "contact.csv", {
			type: "text/csv",
		}),
		mapping: Object.fromEntries(
			cells.map(([column, , target]) => [column, target]),
		),
	};
}

export type SingleContactOutcome =
	| { kind: "added" }
	| { kind: "existing" }
	| { kind: "suppressed" }
	| { kind: "invalid"; reason: string };

export function singleContactOutcome(
	report: ImportReport,
): SingleContactOutcome {
	if (report.invalid > 0) {
		return {
			kind: "invalid",
			reason: report.invalidRows[0]?.reason ?? "The engine refused it.",
		};
	}
	if (report.suppressed > 0) return { kind: "suppressed" };
	if (report.created > 0) return { kind: "added" };
	return { kind: "existing" };
}
