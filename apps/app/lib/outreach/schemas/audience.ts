import { z } from "zod";
import {
	clickVerdict,
	contactStatus,
	nullableDate,
	pageMeta,
	suppressionReason,
	trackedEmailSource,
} from "./enums";

export const contactEngagement = z.object({
	emailsSent: z.number(),
	lastEmailedAt: nullableDate,
	replyCount: z.number(),
	lastRepliedAt: nullableDate,
	clickCount: z.number(),
	realClickCount: z.number(),
	lastClickedAt: nullableDate,
});

export const audienceContact = z.object({
	id: z.string(),
	email: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	company: z.string(),
	title: z.string(),
	custom: z.record(z.string(), z.string()),
	listIds: z.array(z.string()),
	status: contactStatus,
	suppressed: z.boolean(),
	engagement: contactEngagement,
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const audienceContactPage = z.object({
	data: z.array(audienceContact),
	...pageMeta,
});

export const audienceList = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	contactCount: z.number(),
	linkDestinationUrl: z.string().nullable(),
	linkDomainId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const audienceListPage = z.object({
	data: z.array(audienceList),
	...pageMeta,
});

export const suppression = z.object({
	id: z.string(),
	email: z.string(),
	reason: suppressionReason,
	note: z.string(),
	createdAt: z.string(),
});

export const suppressionPage = z.object({
	data: z.array(suppression),
	...pageMeta,
});

export const suppressionImportReport = z.object({
	total: z.number(),
	added: z.number(),
	alreadySuppressed: z.number(),
	duplicatesInFile: z.number(),
	invalid: z.number(),
	contactsUpdated: z.number(),
});

export const columnTarget = z.enum([
	"email",
	"firstName",
	"lastName",
	"company",
	"title",
	"custom",
	"skip",
]);

export const importPreview = z.object({
	columns: z.array(z.string()),
	rows: z.array(z.record(z.string(), z.string())),
	totalRows: z.number(),
	suggestedMapping: z.record(z.string(), columnTarget),
});

export const importReport = z.object({
	total: z.number(),
	created: z.number(),
	updated: z.number(),
	duplicatesInFile: z.number(),
	invalid: z.number(),
	suppressed: z.number(),
	invalidRows: z.array(
		z.object({ row: z.number(), email: z.string(), reason: z.string() }),
	),
	links: z
		.object({
			created: z.number(),
			total: z.number(),
			destinationUrl: z.string(),
			baseUrl: z.string(),
			domainId: z.string().nullable(),
		})
		.nullable(),
});

export const contactTimelineItem = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("sent"),
		at: z.string(),
		subject: z.string(),
		inboxEmail: z.string(),
		source: trackedEmailSource,
		wrongLink: z.boolean(),
	}),
	z.object({
		type: z.literal("replied"),
		at: z.string(),
		subject: z.string(),
		from: z.string(),
	}),
	z.object({
		type: z.literal("click"),
		at: z.string(),
		verdict: clickVerdict,
		reasons: z.array(z.string()),
		destinationUrl: z.string(),
	}),
]);

export const trackedLink = z.object({
	id: z.string(),
	token: z.string(),
	url: z.string(),
	trackingHost: z.string().nullable(),
	destinationUrl: z.string(),
	label: z.string(),
	createdAt: z.string(),
	sentCount: z.number(),
	firstSentAt: nullableDate,
	lastSentAt: nullableDate,
	clickCount: z.number(),
	realClickCount: z.number(),
	firstRealClickAt: nullableDate,
	lastClickAt: nullableDate,
});

export type ContactEngagement = z.infer<typeof contactEngagement>;
export type AudienceContact = z.infer<typeof audienceContact>;
export type AudienceList = z.infer<typeof audienceList>;
export type Suppression = z.infer<typeof suppression>;
export type SuppressionImportReport = z.infer<typeof suppressionImportReport>;
export type ColumnTarget = z.infer<typeof columnTarget>;
export type ImportPreview = z.infer<typeof importPreview>;
export type ImportReport = z.infer<typeof importReport>;
export type ContactTimelineItem = z.infer<typeof contactTimelineItem>;
export type TrackedLink = z.infer<typeof trackedLink>;
