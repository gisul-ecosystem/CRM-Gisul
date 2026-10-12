import { OVERVIEW } from "./overview-config";

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isYearMonth(value: string): boolean {
	return YEAR_MONTH.test(value);
}

export function yearMonthKey(date = new Date()): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${date.getFullYear()}-${month}`;
}

export function monthStartFromKey(key: string): Date {
	const [year = 0, month = 1] = key.split("-").map(Number);
	return new Date(year, month - 1, 1);
}

export function monthEndFromKey(key: string): Date {
	const [year = 0, month = 1] = key.split("-").map(Number);
	return new Date(year, month, 0);
}

export function listYearMonthKeys(anchor = new Date()): string[] {
	const { pastCount, futureCount } = OVERVIEW.months;
	const keys: string[] = [];
	for (let offset = -futureCount; offset <= pastCount; offset += 1) {
		keys.push(
			yearMonthKey(
				new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1),
			),
		);
	}
	return keys;
}

export function monthTitle(key: string, currentKey = yearMonthKey()): string {
	if (key === currentKey) return "This Month";
	return monthStartFromKey(key).toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});
}

export function monthRangeLabel(key: string): string {
	const start = monthStartFromKey(key);
	const end = monthEndFromKey(key);
	return `${formatDay(start)} – ${formatDay(end)}`;
}

function formatDay(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

