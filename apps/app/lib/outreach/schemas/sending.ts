import { z } from "zod";
import {
	dnsCheckResult,
	domainStatus,
	inboxStatus,
	nullableDate,
	pageMeta,
	providerStatus,
	providerType,
	sendFormat,
	zeptoRegion,
} from "./enums";

export const sendingDomain = z.object({
	id: z.string(),
	name: z.string(),
	status: domainStatus,
	providerConnectionId: z.string().nullable(),
	dns: z.object({
		spf: dnsCheckResult,
		dkim: dnsCheckResult,
		dmarc: dnsCheckResult,
		mx: dnsCheckResult,
		records: z.object({
			spf: z.array(z.string()),
			dkim: z.array(z.string()),
			dmarc: z.array(z.string()),
			mx: z.array(z.string()),
		}),
		checkedAt: nullableDate,
	}),
	trackingHost: z.string().nullable(),
	inboxCount: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const sendingDomainPage = z.object({
	data: z.array(sendingDomain),
	...pageMeta,
});

export const sendingInbox = z.object({
	id: z.string(),
	email: z.string(),
	displayName: z.string(),
	senderName: z.string(),
	senderRole: z.string(),
	domainId: z.string(),
	domainName: z.string(),
	providerConnectionId: z.string().nullable(),
	providerName: z.string().nullable(),
	readingConnectionId: z.string().nullable(),
	readingConnectionName: z.string().nullable(),
	status: inboxStatus,
	pauseReason: z.string().nullable(),
	dailyLimit: z.number(),
	minGapSeconds: z.number(),
	maxGapSeconds: z.number(),
	lastSentAt: nullableDate,
	consecutiveFailures: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const sendingInboxPage = z.object({
	data: z.array(sendingInbox),
	...pageMeta,
});

export const discoveredMailboxes = z.object({
	domainName: z.string(),
	providerConnectionId: z.string(),
	mailboxes: z.array(
		z.object({
			email: z.string(),
			displayName: z.string(),
			enabled: z.boolean(),
			alreadyAdded: z.boolean(),
		}),
	),
});

export const importInboxesResult = z.object({
	imported: z.array(z.string()),
	skipped: z.array(z.object({ email: z.string(), reason: z.string() })),
});

export const provider = z.object({
	id: z.string(),
	name: z.string(),
	type: providerType,
	tenantId: z.string(),
	clientId: z.string(),
	secretSet: z.boolean(),
	status: providerStatus,
	lastCheckedAt: nullableDate,
	lastError: z.string().nullable(),
	sendFormat,
	grantedPermissions: z.array(z.string()).nullable(),
	region: zeptoRegion.nullable(),
	inboxCount: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const providerPage = z.object({
	data: z.array(provider),
	...pageMeta,
});

export type SendingDomain = z.infer<typeof sendingDomain>;
export type SendingInbox = z.infer<typeof sendingInbox>;
export type DiscoveredMailboxes = z.infer<typeof discoveredMailboxes>;
export type ImportInboxesResult = z.infer<typeof importInboxesResult>;
export type Provider = z.infer<typeof provider>;
