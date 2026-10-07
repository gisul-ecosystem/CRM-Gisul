import { ActivityType, type Db, DealStage, LeadSource, Prisma } from "@crm/db";
import { dealStageLabel, OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import { activityMeta } from "@crm/validation/activity-meta";
import { Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { DASHBOARD } from "./dashboard-config";
import type {
	DashboardReportInput,
	DashboardSummaryInput,
} from "./dashboard.contracts";
import {
	deltaPercent,
	reportWindow,
	trendBuckets,
} from "./dashboard-report-window";

const LEAD_SOURCE_ORDER = Object.values(LeadSource);

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const TREND_MONTHS = DASHBOARD.summary.trendMonths;

const RATE_WINDOW_DAYS = DASHBOARD.summary.rateWindowDays;

const DAY_MS = DASHBOARD.summary.dayMs;

const ACTIVITY_LABELS: Record<
	(typeof DASHBOARD.report.activityTypes)[number],
	string
> = {
	[ActivityType.CALL]: "Calls",
	[ActivityType.MEETING]: "Meetings",
	[ActivityType.EMAIL]: "Emails",
	[ActivityType.TASK]: "Tasks",
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth() + offset, 1);
}

function monthKey(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

function anchorFromMonth(month: string | undefined, now: Date): Date {
	if (!month) return monthStart(now, 0);
	const [year, monthPart] = month.split("-");
	const yearNumber = Number(year);
	const monthIndex = Number(monthPart) - 1;
	if (
		!Number.isFinite(yearNumber) ||
		!Number.isFinite(monthIndex) ||
		monthIndex < 0 ||
		monthIndex > 11
	) {
		return monthStart(now, 0);
	}
	return new Date(yearNumber, monthIndex, 1);
}

@Injectable()
export class DashboardService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async summary(actingUserId: string, input: DashboardSummaryInput) {
		const mine = input.scope === "me";
		const owned = mine
			? { ownerId: actingUserId, archivedAt: null }
			: { archivedAt: null };

		const now = new Date();
		const startOfMonth = anchorFromMonth(input.month, now);
		const startOfNextMonth = monthStart(startOfMonth, 1);
		const startOfPrevMonth = monthStart(startOfMonth, -1);
		const trendStart = monthStart(startOfMonth, -(TREND_MONTHS - 1));
		const asOf =
			startOfNextMonth.getTime() <= now.getTime()
				? new Date(startOfNextMonth.getTime() - 1)
				: now;
		const rateStart = new Date(asOf.getTime() - RATE_WINDOW_DAYS * DAY_MS);

		const base = await this.conversion.reportingCurrency();
		const counted = this.conversion.countedWhere(base);

		const contactOwned = mine ? { ownerId: actingUserId } : {};

		const contactBase = { ...contactOwned, archivedAt: null };

		const [
			openByStage,
			openValueByStage,
			recentDeals,
			closingThisMonthTotals,
			biggestOpen,
			overdueTasks,
			recentActivity,
			unconverted,
			leadSourceGroups,
			products,
			leadByProduct,
			openDealsByProduct,
			openValueByProduct,
			wonByProduct,
			leadsTotal,
			leadsCreatedThisMonth,
			leadsCreatedPrevMonth,
		] = await Promise.all([
			this.db.deal.groupBy({
				by: ["stage"],
				where: { ...owned, stage: { in: [...OPEN_DEAL_STAGES] } },
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["stage"],
				where: {
					AND: [{ ...owned, stage: { in: [...OPEN_DEAL_STAGES] } }, counted],
				},
				_sum: { baseAmount: true },
			}),
			this.db.deal.findMany({
				where: {
					...owned,
					OR: [
						{ createdAt: { gte: trendStart } },
						{ closedAt: { gte: trendStart } },
					],
				},
				select: {
					baseAmount: true,
					baseCurrency: true,
					stage: true,
					createdAt: true,
					closedAt: true,
				},
			}),
			this.db.deal.aggregate({
				where: {
					AND: [
						{
							...owned,
							stage: { in: [...OPEN_DEAL_STAGES] },
							expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
						},
						counted,
					],
				},
				_count: { _all: true },
				_sum: { baseAmount: true },
			}),
			this.db.deal.findMany({
				where: { ...owned, stage: { in: [...OPEN_DEAL_STAGES] } },
				orderBy: [
					{ baseAmount: { sort: "desc", nulls: "last" } },
					{ expectedCloseDate: "asc" },
				],
				take: 6,
				select: {
					id: true,
					name: true,
					stage: true,
					amount: true,
					currency: true,
					baseAmount: true,
					baseCurrency: true,
					expectedCloseDate: true,
					stageChangedAt: true,
					company: {
						select: {
							id: true,
							name: true,
							iconUrl: true,
							iconDarkUrl: true,
							iconTone: true,
						},
					},
					owner: { select: OWNER_SELECT },
				},
			}),
			this.db.activity.findMany({
				where: {
					type: ActivityType.TASK,
					completedAt: null,
					dueAt: { lt: now },
					createdById: actingUserId,
				},
				orderBy: [{ dueAt: "asc" }],
				take: 10,
				select: {
					id: true,
					subject: true,
					dueAt: true,
					company: { select: { id: true, name: true } },
					deal: { select: { id: true, name: true } },
				},
			}),
			this.db.activity.findMany({
				where: mine ? { createdById: actingUserId } : {},
				orderBy: [{ createdAt: "desc" }],
				take: 12,
				select: {
					id: true,
					type: true,
					subject: true,
					body: true,
					createdAt: true,
					meta: true,
					createdBy: { select: OWNER_SELECT },
					company: { select: { id: true, name: true } },
					deal: { select: { id: true, name: true } },
				},
			}),
			this.conversion.unconverted(owned),
			this.db.contact.groupBy({
				by: ["leadSource"],
				where: contactBase,
				_count: { _all: true },
			}),
			this.db.product.findMany({
				where: { archivedAt: null },
				orderBy: [{ position: "asc" }, { name: "asc" }],
				select: { id: true, name: true, color: true },
			}),
			this.db.contact.groupBy({
				by: ["productId"],
				where: contactBase,
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["productId"],
				where: { ...owned, stage: { in: [...OPEN_DEAL_STAGES] } },
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["productId"],
				where: {
					AND: [
						{ ...owned, stage: { in: [...OPEN_DEAL_STAGES] } },
						counted,
					],
				},
				_sum: { baseAmount: true },
			}),
			this.db.deal.groupBy({
				by: ["productId"],
				where: { ...owned, stage: DealStage.CLOSED_WON },
				_count: { _all: true },
			}),
			this.db.contact.count({ where: contactBase }),
			this.db.contact.count({
				where: {
					...contactBase,
					createdAt: { gte: startOfMonth, lt: startOfNextMonth },
				},
			}),
			this.db.contact.count({
				where: {
					...contactBase,
					createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
				},
			}),
		]);

		const stages = OPEN_DEAL_STAGES.map((stage) => {
			const group = openByStage.find((row) => row.stage === stage);
			const value = openValueByStage.find((row) => row.stage === stage);
			return {
				stage: stage as DealStage,
				count: group?._count._all ?? 0,
				valueCents: toCents(value?._sum.baseAmount ?? null) ?? 0,
			};
		});

		const firstBucket = monthKey(trendStart);
		const trend = Array.from({ length: TREND_MONTHS }, (_, index) => ({
			month: MONTH_LABEL.format(monthStart(trendStart, index)),
			won: 0,
			created: 0,
		}));

		const wonThisMonth = { count: 0, valueCents: 0 };
		const wonPrevMonth = { count: 0, valueCents: 0 };
		let wins = 0;
		let losses = 0;
		let valuedWins = 0;
		let wonCents = 0;
		let cycleDays = 0;
		let winsThisMonth = 0;
		let lossesThisMonth = 0;
		let winsPrevMonth = 0;
		let lossesPrevMonth = 0;

		for (const deal of recentDeals) {
			const valued =
				deal.baseCurrency === base ? toCents(deal.baseAmount) : null;
			const cents = valued ?? 0;

			const created = trend[monthKey(deal.createdAt) - firstBucket];
			if (created) created.created += cents;

			const { closedAt, stage } = deal;
			if (!closedAt) continue;
			const won = stage === DealStage.CLOSED_WON;
			const lost = stage === DealStage.CLOSED_LOST;

			if (won) {
				const closed = trend[monthKey(closedAt) - firstBucket];
				if (closed) closed.won += cents;

				if (closedAt >= startOfMonth && closedAt < startOfNextMonth) {
					wonThisMonth.count += 1;
					wonThisMonth.valueCents += cents;
				} else if (closedAt >= startOfPrevMonth && closedAt < startOfMonth) {
					wonPrevMonth.count += 1;
					wonPrevMonth.valueCents += cents;
				}
			}

			if (closedAt >= startOfMonth && closedAt < startOfNextMonth) {
				if (won) winsThisMonth += 1;
				else if (lost) lossesThisMonth += 1;
			} else if (closedAt >= startOfPrevMonth && closedAt < startOfMonth) {
				if (won) winsPrevMonth += 1;
				else if (lost) lossesPrevMonth += 1;
			}

			if (closedAt < rateStart) continue;
			if (won) {
				wins += 1;
				if (valued !== null) {
					valuedWins += 1;
					wonCents += cents;
				}
				cycleDays += (closedAt.getTime() - deal.createdAt.getTime()) / DAY_MS;
			} else if (lost) {
				losses += 1;
			}
		}

		const decided = wins + losses;
		const decidedThisMonth = winsThisMonth + lossesThisMonth;
		const decidedPrevMonth = winsPrevMonth + lossesPrevMonth;

		return {
			scope: input.scope,
			reportingCurrency: base,
			unconverted,
			leads: {
				total: leadsTotal,
				createdThisMonth: leadsCreatedThisMonth,
				createdPrevMonth: leadsCreatedPrevMonth,
			},
			pipeline: {
				stages,
				totalCents: stages.reduce((total, s) => total + s.valueCents, 0),
				totalDeals: stages.reduce((total, s) => total + s.count, 0),
			},
			wonThisMonth,
			wonPrevMonth,
			performance: {
				windowDays: RATE_WINDOW_DAYS,
				wins,
				losses,
				winRate: decided === 0 ? null : wins / decided,
				winRateThisMonth:
					decidedThisMonth === 0 ? null : winsThisMonth / decidedThisMonth,
				winRatePrevMonth:
					decidedPrevMonth === 0 ? null : winsPrevMonth / decidedPrevMonth,
				avgDealCents:
					valuedWins === 0 ? null : Math.round(wonCents / valuedWins),
				avgCycleDays: wins === 0 ? null : Math.round(cycleDays / wins),
			},
			trend,
			closingThisMonthTotal: {
				count: closingThisMonthTotals._count._all,
				valueCents: toCents(closingThisMonthTotals._sum.baseAmount) ?? 0,
			},
			biggestOpen: biggestOpen
				.map(
					({
						amount,
						baseAmount,
						baseCurrency,
						expectedCloseDate,
						stageChangedAt,
						...deal
					}) => ({
						...deal,
						amountCents: toCents(amount),
						baseAmountCents: baseCurrency === base ? toCents(baseAmount) : null,
						expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
						stageChangedAt: stageChangedAt.toISOString(),
					}),
				)
				.sort((a, b) => (b.baseAmountCents ?? -1) - (a.baseAmountCents ?? -1)),
			overdueTasks: overdueTasks.map(({ dueAt, ...task }) => ({
				...task,
				dueAt: dueAt?.toISOString() ?? null,
			})),
			recentActivity: recentActivity.map(({ createdAt, meta, ...entry }) => ({
				...entry,
				createdAt: createdAt.toISOString(),
				meta: activityMeta.parse(meta),
			})),
			leadSources: buildLeadSources(leadSourceGroups),
			productPerformance: products.map((product) => ({
				id: product.id,
				name: product.name,
				color: product.color,
				leads:
					leadByProduct.find((row) => row.productId === product.id)?._count
						._all ?? 0,
				deals:
					openDealsByProduct.find((row) => row.productId === product.id)?._count
						._all ?? 0,
				won:
					wonByProduct.find((row) => row.productId === product.id)?._count
						._all ?? 0,
				pipelineCents:
					toCents(
						openValueByProduct.find((row) => row.productId === product.id)?._sum
							.baseAmount ?? null,
					) ?? 0,
			})),
		};
	}

	async report(input: DashboardReportInput) {
		const window = reportWindow(input.range);
		const base = await this.conversion.reportingCurrency();
		const counted = this.conversion.countedWhere(base);
		const ownerFilter = input.ownerId ? { ownerId: input.ownerId } : {};
		const productFilter = input.productId
			? { productId: input.productId }
			: {};
		const stageProductFilter = input.stageProductId
			? { productId: input.stageProductId }
			: productFilter;

		const contactBase = {
			archivedAt: null,
			...ownerFilter,
			...productFilter,
		} satisfies Prisma.ContactWhereInput;

		const companyBase = {
			archivedAt: null,
			...ownerFilter,
		} satisfies Prisma.CompanyWhereInput;

		const dealBase = {
			archivedAt: null,
			...ownerFilter,
			...productFilter,
		} satisfies Prisma.DealWhereInput;

		const stageDealBase = {
			archivedAt: null,
			...ownerFilter,
			...stageProductFilter,
		} satisfies Prisma.DealWhereInput;

		const activityBase = {
			type: { in: [...DASHBOARD.report.activityTypes] },
			createdAt: { gte: window.start, lt: window.end },
			...(input.ownerId ? { createdById: input.ownerId } : {}),
		} satisfies Prisma.ActivityWhereInput;

		const [
			newLeads,
			prevLeads,
			newCustomers,
			prevCustomers,
			wonNow,
			wonPrev,
			openByStage,
			openValueByStage,
			wonStage,
			leadSourceGroups,
			recentDeals,
			activityGroups,
			leadCreatedAt,
			products,
			owners,
		] = await Promise.all([
			this.db.contact.count({
				where: {
					...contactBase,
					createdAt: { gte: window.start, lt: window.end },
				},
			}),
			this.db.contact.count({
				where: {
					...contactBase,
					createdAt: { gte: window.prevStart, lt: window.prevEnd },
				},
			}),
			this.db.company.count({
				where: {
					...companyBase,
					createdAt: { gte: window.start, lt: window.end },
				},
			}),
			this.db.company.count({
				where: {
					...companyBase,
					createdAt: { gte: window.prevStart, lt: window.prevEnd },
				},
			}),
			this.db.deal.aggregate({
				where: {
					AND: [
						{
							...dealBase,
							stage: DealStage.CLOSED_WON,
							closedAt: { gte: window.start, lt: window.end },
						},
						counted,
					],
				},
				_count: { _all: true },
				_sum: { baseAmount: true },
			}),
			this.db.deal.aggregate({
				where: {
					AND: [
						{
							...dealBase,
							stage: DealStage.CLOSED_WON,
							closedAt: { gte: window.prevStart, lt: window.prevEnd },
						},
						counted,
					],
				},
				_count: { _all: true },
				_sum: { baseAmount: true },
			}),
			this.db.deal.groupBy({
				by: ["stage"],
				where: {
					...stageDealBase,
					stage: { in: [...OPEN_DEAL_STAGES] },
				},
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["stage"],
				where: {
					AND: [
						{
							...stageDealBase,
							stage: { in: [...OPEN_DEAL_STAGES] },
						},
						counted,
					],
				},
				_sum: { baseAmount: true },
			}),
			this.db.deal.count({
				where: {
					...stageDealBase,
					stage: DealStage.CLOSED_WON,
				},
			}),
			this.db.contact.groupBy({
				by: ["leadSource"],
				where: contactBase,
				_count: { _all: true },
			}),
			this.db.deal.findMany({
				where: dealBase,
				orderBy: [{ updatedAt: "desc" }],
				take: DASHBOARD.report.recentDealsLimit,
				select: {
					id: true,
					name: true,
					stage: true,
					baseAmount: true,
					baseCurrency: true,
					expectedCloseDate: true,
					updatedAt: true,
					company: { select: { name: true } },
				},
			}),
			this.db.activity.groupBy({
				by: ["type"],
				where: activityBase,
				_count: { _all: true },
			}),
			this.db.contact.findMany({
				where: {
					...contactBase,
					createdAt: { gte: window.start, lt: window.end },
				},
				select: { createdAt: true },
			}),
			this.db.product.findMany({
				where: { archivedAt: null },
				orderBy: [{ position: "asc" }, { name: "asc" }],
				select: { id: true, name: true },
			}),
			this.db.user.findMany({
				orderBy: [{ name: "asc" }],
				select: { id: true, name: true },
			}),
		]);

		const revenueCents = toCents(wonNow._sum.baseAmount) ?? 0;
		const prevRevenueCents = toCents(wonPrev._sum.baseAmount) ?? 0;

		const buckets = trendBuckets(window, input.trendGrain);
		const leadsTrend = buckets.map((bucket) => ({
			label: bucket.label,
			count: leadCreatedAt.filter(
				(row) =>
					row.createdAt >= bucket.start && row.createdAt < bucket.end,
			).length,
		}));

		const dealsByStage = [
			...OPEN_DEAL_STAGES.map((stage) => {
				const group = openByStage.find((row) => row.stage === stage);
				const value = openValueByStage.find((row) => row.stage === stage);
				return {
					stage,
					label: dealStageLabel(stage),
					count: group?._count._all ?? 0,
					valueCents: toCents(value?._sum.baseAmount ?? null) ?? 0,
				};
			}),
			{
				stage: DealStage.CLOSED_WON,
				label: dealStageLabel(DealStage.CLOSED_WON),
				count: wonStage,
				valueCents: 0,
			},
		];

		const activityCounts = new Map(
			activityGroups.map((row) => [row.type, row._count._all] as const),
		);

		return {
			reportingCurrency: base,
			range: {
				key: input.range,
				label: window.label,
				start: window.start.toISOString(),
				end: window.end.toISOString(),
			},
			kpis: {
				newLeads: {
					value: newLeads,
					previous: prevLeads,
					deltaPercent: deltaPercent(newLeads, prevLeads),
				},
				newCustomers: {
					value: newCustomers,
					previous: prevCustomers,
					deltaPercent: deltaPercent(newCustomers, prevCustomers),
				},
				dealsWon: {
					value: wonNow._count._all,
					previous: wonPrev._count._all,
					deltaPercent: deltaPercent(wonNow._count._all, wonPrev._count._all),
				},
				revenueCents: {
					value: revenueCents,
					previous: prevRevenueCents,
					deltaPercent: deltaPercent(revenueCents, prevRevenueCents),
				},
			},
			leadsTrend,
			dealsByStage,
			leadSources: buildLeadSources(leadSourceGroups),
			recentDeals: recentDeals.map((deal) => ({
				id: deal.id,
				name: deal.name,
				companyName: deal.company.name,
				stage: deal.stage,
				stageLabel: dealStageLabel(deal.stage),
				valueCents:
					deal.baseCurrency === base ? toCents(deal.baseAmount) : null,
				expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
				updatedAt: deal.updatedAt.toISOString(),
			})),
			activitiesByType: DASHBOARD.report.activityTypes.map((type) => ({
				type,
				label: ACTIVITY_LABELS[type],
				count: activityCounts.get(type) ?? 0,
			})),
			products,
			owners,
		};
	}
}

function buildLeadSources(
	groups: Array<{ leadSource: LeadSource | null; _count: { _all: number } }>,
) {
	const counts = new Map(
		groups.map((row) => [row.leadSource, row._count._all] as const),
	);
	const rows: Array<{ source: LeadSource | null; count: number }> =
		LEAD_SOURCE_ORDER.map((source) => ({
			source,
			count: counts.get(source) ?? 0,
		}));
	const unset = counts.get(null) ?? 0;
	if (unset > 0) rows.push({ source: null, count: unset });
	return rows;
}
