import { ActivityType, DealStage, LeadSource } from "@crm/db";
import { activityMeta } from "@crm/validation/activity-meta";
import { z } from "zod";
import { DASHBOARD } from "./dashboard-config";

const DASHBOARD_SCOPES = ["me", "everyone"] as const;

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const dashboardSummaryInput = z.object({
	scope: z.enum(DASHBOARD_SCOPES).default("me"),
	month: z.string().regex(YEAR_MONTH).optional(),
});

export type DashboardSummaryInput = z.infer<typeof dashboardSummaryInput>;

export const dashboardReportInput = z.object({
	range: z.enum(DASHBOARD.report.ranges).default("m"),
	productId: z.string().trim().min(1).optional(),
	ownerId: z.string().trim().min(1).optional(),
	stageProductId: z.string().trim().min(1).optional(),
	trendGrain: z.enum(DASHBOARD.report.trendGrains).default("monthly"),
});

export type DashboardReportInput = z.infer<typeof dashboardReportInput>;

const stageEnum = z.enum(
	Object.values(DealStage) as [DealStage, ...DealStage[]],
);

const ownerOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

const companyBriefOutput = z.object({
	id: z.string(),
	name: z.string(),
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
});

const linkedRecordOutput = z.object({ id: z.string(), name: z.string() });

const monthlyTotalOutput = z.object({
	count: z.number(),
	valueCents: z.number(),
});

const stageBucketOutput = z.object({
	stage: stageEnum,
	count: z.number(),
	valueCents: z.number(),
});

const trendPointOutput = z.object({
	month: z.string(),
	won: z.number(),
	created: z.number(),
});

const unconvertedOutput = z.object({
	count: z.number(),
	currencies: z.array(z.string()),
});

const biggestOpenDealOutput = z.object({
	id: z.string(),
	name: z.string(),
	stage: stageEnum,
	currency: z.string(),
	company: companyBriefOutput,
	owner: ownerOutput,
	amountCents: z.number().nullable(),
	baseAmountCents: z.number().nullable(),
	expectedCloseDate: z.string().nullable(),
	stageChangedAt: z.string(),
});

const overdueTaskOutput = z.object({
	id: z.string(),
	subject: z.string().nullable(),
	company: linkedRecordOutput.nullable(),
	deal: linkedRecordOutput.nullable(),
	dueAt: z.string().nullable(),
});

const recentActivityOutput = z.object({
	id: z.string(),
	type: z.nativeEnum(ActivityType),
	subject: z.string().nullable(),
	body: z.string().nullable(),
	createdBy: ownerOutput,
	company: linkedRecordOutput.nullable(),
	deal: linkedRecordOutput.nullable(),
	createdAt: z.string(),
	meta: activityMeta,
});

const leadSourceBucketOutput = z.object({
	source: z
		.enum(Object.values(LeadSource) as [LeadSource, ...LeadSource[]])
		.nullable(),
	count: z.number(),
});

const productPerformanceOutput = z.object({
	id: z.string(),
	name: z.string(),
	color: z.string(),
	leads: z.number(),
	deals: z.number(),
	won: z.number(),
	pipelineCents: z.number(),
});

export const dashboardSummaryOutput = z.object({
	scope: z.enum(DASHBOARD_SCOPES),
	reportingCurrency: z.string(),
	unconverted: unconvertedOutput,
	leads: z.object({
		total: z.number(),
		createdThisMonth: z.number(),
		createdPrevMonth: z.number(),
	}),
	pipeline: z.object({
		stages: z.array(stageBucketOutput),
		totalCents: z.number(),
		totalDeals: z.number(),
	}),
	wonThisMonth: monthlyTotalOutput,
	wonPrevMonth: monthlyTotalOutput,
	performance: z.object({
		windowDays: z.number(),
		wins: z.number(),
		losses: z.number(),
		winRate: z.number().nullable(),
		winRateThisMonth: z.number().nullable(),
		winRatePrevMonth: z.number().nullable(),
		avgDealCents: z.number().nullable(),
		avgCycleDays: z.number().nullable(),
	}),
	trend: z.array(trendPointOutput),
	closingThisMonthTotal: monthlyTotalOutput,
	biggestOpen: z.array(biggestOpenDealOutput),
	overdueTasks: z.array(overdueTaskOutput),
	recentActivity: z.array(recentActivityOutput),
	leadSources: z.array(leadSourceBucketOutput),
	productPerformance: z.array(productPerformanceOutput),
});

const reportMetricOutput = z.object({
	value: z.number(),
	previous: z.number(),
	deltaPercent: z.number().nullable(),
});

const reportTrendPointOutput = z.object({
	label: z.string(),
	count: z.number(),
});

const reportStageBucketOutput = z.object({
	stage: stageEnum,
	label: z.string(),
	count: z.number(),
	valueCents: z.number(),
});

const reportDealRowOutput = z.object({
	id: z.string(),
	name: z.string(),
	companyName: z.string(),
	stage: stageEnum,
	stageLabel: z.string(),
	valueCents: z.number().nullable(),
	expectedCloseDate: z.string().nullable(),
	updatedAt: z.string(),
});

const reportActivityBucketOutput = z.object({
	type: z.enum([
		ActivityType.CALL,
		ActivityType.MEETING,
		ActivityType.EMAIL,
		ActivityType.TASK,
	]),
	label: z.string(),
	count: z.number(),
});

const reportFilterOptionOutput = z.object({
	id: z.string(),
	name: z.string(),
});

export const dashboardReportOutput = z.object({
	reportingCurrency: z.string(),
	range: z.object({
		key: z.enum(DASHBOARD.report.ranges),
		label: z.string(),
		start: z.string(),
		end: z.string(),
	}),
	kpis: z.object({
		newLeads: reportMetricOutput,
		newCustomers: reportMetricOutput,
		dealsWon: reportMetricOutput,
		revenueCents: reportMetricOutput,
	}),
	leadsTrend: z.array(reportTrendPointOutput),
	dealsByStage: z.array(reportStageBucketOutput),
	leadSources: z.array(leadSourceBucketOutput),
	recentDeals: z.array(reportDealRowOutput),
	activitiesByType: z.array(reportActivityBucketOutput),
	products: z.array(reportFilterOptionOutput),
	owners: z.array(reportFilterOptionOutput),
});
