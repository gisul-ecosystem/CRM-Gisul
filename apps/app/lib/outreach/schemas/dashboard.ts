import { z } from "zod";
import {
	campaignStatus,
	inboxStatus,
	nullableDate,
	sendingMode,
} from "./enums";

export const dashboardSummary = z.object({
	sentToday: z.number(),
	sentThisWeek: z.number(),
	totalSent: z.number(),
	inQueue: z.number(),
	failedToday: z.number(),
	activeInboxes: z.number(),
	realClicksThisWeek: z.number(),
	nextEmail: z
		.object({ to: z.string(), fromInbox: z.string(), scheduledAt: z.string() })
		.nullable(),
	idleReason: z.string().nullable(),
	dryRun: z.boolean(),
	sendingEnabled: z.boolean(),
	mode: sendingMode,
	workerRunning: z.boolean(),
	timezone: z.string(),
	alerts: z.array(
		z.object({
			campaignId: z.string(),
			campaignName: z.string(),
			reason: z.string(),
		}),
	),
});

export const dashboardInbox = z.object({
	id: z.string(),
	email: z.string(),
	domain: z.string(),
	status: inboxStatus,
	pauseReason: z.string().nullable(),
	sentToday: z.number(),
	dailyLimit: z.number(),
	lastSentAt: nullableDate,
	nextScheduledAt: nullableDate,
});

export const timelineDay = z.object({
	date: z.string(),
	sent: z.number(),
	failed: z.number(),
});

export const activityEntry = z.object({
	id: z.string(),
	type: z.string(),
	message: z.string(),
	createdAt: z.string(),
});

export const dashboardCampaign = z.object({
	id: z.string(),
	name: z.string(),
	status: campaignStatus,
	sent: z.number(),
	total: z.number(),
	remaining: z.number(),
	failed: z.number(),
	skipped: z.number(),
	eta: nullableDate,
	timezone: z.string(),
});

export const dashboardClicker = z.object({
	contactId: z.string(),
	email: z.string(),
	name: z.string(),
	company: z.string(),
	realClicks: z.number(),
	botOpens: z.number(),
	lastRealClickAt: nullableDate,
	lastOpenAt: z.string(),
});

export type DashboardSummary = z.infer<typeof dashboardSummary>;
export type DashboardInbox = z.infer<typeof dashboardInbox>;
export type TimelineDay = z.infer<typeof timelineDay>;
export type ActivityEntry = z.infer<typeof activityEntry>;
export type DashboardCampaign = z.infer<typeof dashboardCampaign>;
export type DashboardClicker = z.infer<typeof dashboardClicker>;
