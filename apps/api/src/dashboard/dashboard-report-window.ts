import type {
	DashboardReportRange,
	DashboardReportTrendGrain,
} from "./dashboard-config";

const RANGE_DAY = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});

export type ReportWindow = {
	start: Date;
	end: Date;
	prevStart: Date;
	prevEnd: Date;
	label: string;
};

export function reportWindow(
	range: DashboardReportRange,
	now = new Date(),
): ReportWindow {
	const year = now.getFullYear();
	const month = now.getMonth();

	if (range === "m") {
		const start = new Date(year, month, 1);
		const end = new Date(year, month + 1, 1);
		const prevStart = new Date(year, month - 1, 1);
		return {
			start,
			end,
			prevStart,
			prevEnd: start,
			label: formatRangeLabel(start, end),
		};
	}

	if (range === "lm") {
		const start = new Date(year, month - 1, 1);
		const end = new Date(year, month, 1);
		const prevStart = new Date(year, month - 2, 1);
		return {
			start,
			end,
			prevStart,
			prevEnd: start,
			label: formatRangeLabel(start, end),
		};
	}

	if (range === "q") {
		const quarterStartMonth = Math.floor(month / 3) * 3;
		const start = new Date(year, quarterStartMonth, 1);
		const end = new Date(year, quarterStartMonth + 3, 1);
		const prevStart = new Date(year, quarterStartMonth - 3, 1);
		return {
			start,
			end,
			prevStart,
			prevEnd: start,
			label: formatRangeLabel(start, end),
		};
	}

	const start = new Date(year, 0, 1);
	const end = new Date(year + 1, 0, 1);
	const prevStart = new Date(year - 1, 0, 1);
	return {
		start,
		end,
		prevStart,
		prevEnd: start,
		label: formatRangeLabel(start, end),
	};
}

export function formatRangeLabel(start: Date, end: Date): string {
	const last = new Date(end.getTime() - 1);
	return `${RANGE_DAY.format(start)} – ${RANGE_DAY.format(last)}`;
}

export function deltaPercent(current: number, previous: number): number | null {
	if (previous === 0) return current === 0 ? 0 : null;
	return Math.round(((current - previous) / previous) * 100);
}

export type TrendBucket = {
	key: string;
	label: string;
	start: Date;
	end: Date;
};

export function trendBuckets(
	window: ReportWindow,
	grain: DashboardReportTrendGrain,
): TrendBucket[] {
	if (grain === "weekly") return weekBuckets(window.start, window.end);
	if (grain === "quarterly") return quarterBuckets(window.start, window.end);
	return monthBuckets(window.start, window.end);
}

function monthBuckets(start: Date, end: Date): TrendBucket[] {
	const buckets: TrendBucket[] = [];
	let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
	const label = new Intl.DateTimeFormat("en-US", { month: "short" });
	while (cursor < end) {
		const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
		buckets.push({
			key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
			label: label.format(cursor),
			start: cursor < start ? start : cursor,
			end: next > end ? end : next,
		});
		cursor = next;
	}
	return buckets;
}

function weekBuckets(start: Date, end: Date): TrendBucket[] {
	const buckets: TrendBucket[] = [];
	const cursor = startOfWeek(start);
	let index = 1;
	while (cursor < end) {
		const next = addDays(cursor, 7);
		const bucketStart = cursor < start ? start : new Date(cursor);
		const bucketEnd = next > end ? end : next;
		if (bucketStart < bucketEnd) {
			buckets.push({
				key: `w${index}`,
				label: `W${index}`,
				start: bucketStart,
				end: bucketEnd,
			});
			index += 1;
		}
		cursor.setTime(next.getTime());
	}
	return buckets;
}

function quarterBuckets(start: Date, end: Date): TrendBucket[] {
	const buckets: TrendBucket[] = [];
	let year = start.getFullYear();
	let quarter = Math.floor(start.getMonth() / 3);
	while (true) {
		const bucketStart = new Date(year, quarter * 3, 1);
		const bucketEnd = new Date(year, quarter * 3 + 3, 1);
		if (bucketStart >= end) break;
		const clippedStart = bucketStart < start ? start : bucketStart;
		const clippedEnd = bucketEnd > end ? end : bucketEnd;
		if (clippedStart < clippedEnd) {
			buckets.push({
				key: `${year}-q${quarter + 1}`,
				label: `Q${quarter + 1}`,
				start: clippedStart,
				end: clippedEnd,
			});
		}
		quarter += 1;
		if (quarter > 3) {
			quarter = 0;
			year += 1;
		}
	}
	return buckets;
}

function startOfWeek(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	d.setDate(d.getDate() - d.getDay());
	return d;
}

function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}
