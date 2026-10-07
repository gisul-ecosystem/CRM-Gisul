export const REPORTS = {
	tabs: ["overview", "leads", "deals", "activities"] as const,
	ranges: ["m", "lm", "q", "y"] as const,
	trendModes: ["monthly", "weekly", "quarterly"] as const,
	recentPreview: 4,
	stageColors: [
		"#6b52a3",
		"#b9a3e0",
		"#d5c8ef",
		"#e9e1f6",
		"#8f73c4",
		"#c4b5fd",
		"#a78bfa",
	] as const,
	sourceColors: [
		"#5b44e0",
		"#818cf8",
		"#a5b4fc",
		"#fde047",
		"#cbd5e1",
		"#94a3b8",
		"#e2e8f0",
	] as const,
} as const;

export type ReportTab = (typeof REPORTS.tabs)[number];
export type ReportRange = (typeof REPORTS.ranges)[number];
export type ReportTrendMode = (typeof REPORTS.trendModes)[number];

export function niceStep(x: number) {
	if (x <= 0) return 1;
	const p = 10 ** Math.floor(Math.log10(x));
	const m = x / p;
	const k = ([1, 2, 2.5, 5, 10] as const).find((n) => n >= m) ?? 10;
	return k * p;
}
