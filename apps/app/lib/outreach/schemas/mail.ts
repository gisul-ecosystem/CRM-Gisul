import { z } from "zod";
import {
	clickVerdict,
	incomingEmailKind,
	nullableDate,
	pageMeta,
	trackedEmailSource,
} from "./enums";

const personRef = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
});

const inboxCheck = z.object({
	id: z.string(),
	email: z.string(),
	checkedAt: nullableDate,
});

export const incomingEmail = z.object({
	id: z.string(),
	inboxId: z.string(),
	inboxEmail: z.string(),
	kind: incomingEmailKind,
	fromEmail: z.string(),
	fromName: z.string(),
	subject: z.string(),
	preview: z.string(),
	receivedAt: z.string(),
	campaign: z.object({ id: z.string(), name: z.string() }).nullable(),
	contact: personRef.nullable(),
});

export const incomingEmailDetail = incomingEmail.extend({
	text: z.string(),
	body: z.string(),
});

export const incomingEmailPage = z.object({
	data: z.array(incomingEmail),
	...pageMeta,
	counts: z.object({
		reply: z.number(),
		bounce: z.number(),
		auto_reply: z.number(),
		other: z.number(),
		all: z.number(),
	}),
	inboxes: z.array(inboxCheck),
});

const sentCount = z.object({ emails: z.number(), people: z.number() });

export const trackedStats = z.object({
	timezone: z.string(),
	today: sentCount,
	thisWeek: sentCount,
	thisMonth: sentCount,
	buckets: z.array(
		sentCount.extend({ label: z.string(), from: z.string(), to: z.string() }),
	),
	wrongLinkEmails: z.number(),
	inboxes: z.array(inboxCheck),
});

export const trackedEmail = z.object({
	id: z.string(),
	inboxEmail: z.string(),
	source: trackedEmailSource,
	subject: z.string(),
	to: z.array(z.string()),
	cc: z.array(z.string()),
	bcc: z.array(z.string()),
	contacts: z.array(personRef),
	sentAt: z.string(),
	repliedAt: nullableDate,
	replyFromEmail: z.string().nullable(),
	clicks: z.object({ total: z.number(), real: z.number() }),
	wrongLinks: z.array(
		z.object({
			token: z.string(),
			ownerEmail: z.string(),
			ownerName: z.string(),
		}),
	),
});

export const trackedEmailPage = z.object({
	data: z.array(trackedEmail),
	...pageMeta,
});

export const linkClick = z.object({
	id: z.string(),
	at: z.string(),
	verdict: clickVerdict,
	reasons: z.array(z.string()),
	method: z.string(),
	userAgent: z.string(),
	destinationUrl: z.string(),
	contact: personRef.nullable(),
});

export const linkClickPage = z.object({
	data: z.array(linkClick),
	...pageMeta,
});

export const trackingConfig = z.object({
	baseUrl: z.string(),
	isLocal: z.boolean(),
	homepage: z.string(),
	allowedHosts: z.array(z.string()),
	domains: z.array(
		z.object({ id: z.string(), name: z.string(), trackingHost: z.string() }),
	),
});

export type IncomingEmail = z.infer<typeof incomingEmail>;
export type IncomingEmailDetail = z.infer<typeof incomingEmailDetail>;
export type IncomingEmailPage = z.infer<typeof incomingEmailPage>;
export type TrackedStats = z.infer<typeof trackedStats>;
export type TrackedEmail = z.infer<typeof trackedEmail>;
export type LinkClick = z.infer<typeof linkClick>;
export type TrackingConfig = z.infer<typeof trackingConfig>;
