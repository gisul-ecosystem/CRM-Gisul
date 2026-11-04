import type { ColumnTarget } from "./schemas/audience";

export const COLUMN_TARGETS: readonly ColumnTarget[] = [
	"email",
	"firstName",
	"lastName",
	"company",
	"title",
	"custom",
	"skip",
];

export const FIELD_LABELS = {
	email: "Email (required)",
	firstName: "First name",
	lastName: "Last name",
	company: "Company",
	title: "Job title",
	custom: "Custom field",
	skip: "Don't import",
} as const satisfies Record<ColumnTarget, string>;

export const IMPORT_LIMITS = {
	maxBytes: 5 * 1024 * 1024,
	maxRows: 50_000,
	maxLabel: "5 MB / 50,000 rows",
} as const;

export type ColumnMapping = { [column: string]: ColumnTarget };

export function customKey(column: string): string {
	const key = column
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	if (!key) return "field";
	return /^[0-9]/.test(key) ? `f_${key}` : key;
}

export function mappingProblem(mapping: ColumnMapping): string | null {
	const targets = Object.values(mapping);
	if (targets.filter((target) => target === "email").length !== 1)
		return "Choose exactly one column as Email.";
	const standard = targets.filter(
		(target) => target !== "custom" && target !== "skip",
	);
	if (new Set(standard).size !== standard.length)
		return "Each field can only be chosen for one column.";
	return null;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
	return EMAIL_SHAPE.test(value.trim().toLowerCase());
}
