import { z } from "zod";
import { campaignStatus, messageStatus, nullableDate, pageMeta } from "./enums";

export const sendWindow = z.object({
	startMinute: z.number(),
	endMinute: z.number(),
	days: z.array(z.number()),
});

export const campaignVariant = z.object({
	name: z.string(),
	subjectTemplate: z.string(),
	bodyTemplate: z.string(),
	bodyHtml: z.string().nullable(),
	matchValues: z.array(z.string()),
});

export const messageCounts = z.object({
	pending: z.number(),
	scheduled: z.number(),
	sending: z.number(),
	sent: z.number(),
	failed: z.number(),
	skipped: z.number(),
});

export const campaign = z.object({
	id: z.string(),
	name: z.string(),
	listId: z.string(),
	listName: z.string().nullable(),
	inboxIds: z.array(z.string()),
	subjectTemplate: z.string(),
	bodyTemplate: z.string(),
	bodyHtml: z.string().nullable(),
	templates: z.array(
		z.object({ name: z.string(), matchValues: z.array(z.string()) }),
	),
	templateName: z.string(),
	matchValues: z.array(z.string()),
	variants: z.array(campaignVariant),
	variantColumn: z.string(),
	followUpOf: z.string().nullable(),
	followUpAfterDays: z.number(),
	pauseReason: z.string().nullable(),
	sendWindow,
	status: campaignStatus,
	startedAt: nullableDate,
	completedAt: nullableDate,
	createdAt: z.string(),
	updatedAt: z.string(),
	counts: messageCounts,
	totalMessages: z.number(),
});

export const campaignPage = z.object({
	data: z.array(campaign),
	...pageMeta,
});

export const campaignStats = z.object({
	status: campaignStatus,
	counts: messageCounts,
	totalMessages: z.number(),
	remaining: z.number(),
	audience: z.object({
		total: z.number(),
		sendable: z.number(),
		skipped: z.number(),
	}),
	usableInboxes: z.number(),
	dailyCapacity: z.number(),
	timezone: z.string(),
	eta: nullableDate,
	nextWindowStart: nullableDate,
});

export const campaignPreview = z.object({
	contact: z
		.object({
			id: z.string(),
			email: z.string(),
			firstName: z.string(),
			lastName: z.string(),
			company: z.string(),
		})
		.nullable(),
	subject: z.string(),
	text: z.string(),
	html: z.string().nullable(),
	warnings: z.array(z.string()),
	customVariables: z.array(z.string()),
});

export const startCampaignResult = z.object({
	campaign,
	created: z.number(),
	pending: z.number(),
	skipped: z.number(),
});

export const campaignMessage = z.object({
	id: z.string(),
	contactId: z.string(),
	toEmail: z.string(),
	status: messageStatus,
	inboxId: z.string().nullable(),
	inboxEmail: z.string().nullable(),
	scheduledAt: nullableDate,
	sentAt: nullableDate,
	attempts: z.number(),
	renderedSubject: z.string().nullable(),
	templateName: z.string().nullable(),
	repliedAt: nullableDate,
	bounce: z.object({ code: z.string(), message: z.string() }).nullable(),
	error: z.object({ code: z.string(), message: z.string() }).nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const campaignMessagePage = z.object({
	data: z.array(campaignMessage),
	...pageMeta,
});

export const testSendResult = z.object({
	mode: z.enum(["dry-run", "live"]),
	to: z.string(),
	from: z.string(),
	providerMessageId: z.string().nullable(),
	format: z.enum(["outlook", "mime"]),
});

export type SendWindow = z.infer<typeof sendWindow>;
export type CampaignVariant = z.infer<typeof campaignVariant>;
export type MessageCounts = z.infer<typeof messageCounts>;
export type Campaign = z.infer<typeof campaign>;
export type CampaignStats = z.infer<typeof campaignStats>;
export type CampaignPreview = z.infer<typeof campaignPreview>;
export type StartCampaignResult = z.infer<typeof startCampaignResult>;
export type CampaignMessage = z.infer<typeof campaignMessage>;
export type TestSendResult = z.infer<typeof testSendResult>;
