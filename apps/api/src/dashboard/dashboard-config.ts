import { ActivityType } from "@crm/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DASHBOARD = {
	summary: {
		trendMonths: 6,
		rateWindowDays: 90,
		dayMs: DAY_MS,
	},
	report: {
		ranges: ["m", "lm", "q", "y"] as const,
		trendGrains: ["monthly", "weekly", "quarterly"] as const,
		activityTypes: [
			ActivityType.CALL,
			ActivityType.MEETING,
			ActivityType.EMAIL,
			ActivityType.TASK,
		] as const,
		recentDealsLimit: 20,
		dayMs: DAY_MS,
	},
} as const;

export type DashboardReportRange =
	(typeof DASHBOARD.report.ranges)[number];
export type DashboardReportTrendGrain =
	(typeof DASHBOARD.report.trendGrains)[number];
