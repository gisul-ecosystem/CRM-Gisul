import { z } from "zod";

export const PROVIDER_TYPES = ["microsoft", "google", "zeptomail"] as const;
export const ZEPTO_REGIONS = ["in", "com", "eu", "com.au"] as const;
export const PROVIDER_STATUSES = ["connected", "error", "unchecked"] as const;
export const SEND_FORMATS = ["outlook", "mime"] as const;
export const DOMAIN_STATUSES = ["active", "paused"] as const;
export const DNS_CHECK_RESULTS = ["pass", "fail", "unknown"] as const;
export const INBOX_STATUSES = ["active", "paused", "error"] as const;
export const CONTACT_STATUSES = ["active", "unsubscribed", "bounced"] as const;
export const SUPPRESSION_REASONS = [
	"unsubscribed",
	"bounced",
	"manual",
	"complaint",
] as const;
export const CAMPAIGN_STATUSES = [
	"draft",
	"running",
	"paused",
	"completed",
] as const;
export const MESSAGE_STATUSES = [
	"pending",
	"scheduled",
	"sending",
	"sent",
	"failed",
	"skipped",
] as const;
export const TRACKED_EMAIL_SOURCES = ["manual", "engine"] as const;
export const INCOMING_EMAIL_KINDS = [
	"reply",
	"bounce",
	"auto_reply",
	"other",
] as const;
export const INCOMING_KIND_FILTERS = [...INCOMING_EMAIL_KINDS, "all"] as const;
export const CLICK_VERDICTS = ["click", "suspicious", "bot"] as const;
export const CLICK_FILTERS = ["real", "real-and-maybe", "all"] as const;
export const SENDING_MODES = ["dry-run", "live", "disabled"] as const;

export const providerType = z.enum(PROVIDER_TYPES);
export const zeptoRegion = z.enum(ZEPTO_REGIONS);
export const providerStatus = z.enum(PROVIDER_STATUSES);
export const sendFormat = z.enum(SEND_FORMATS);
export const domainStatus = z.enum(DOMAIN_STATUSES);
export const dnsCheckResult = z.enum(DNS_CHECK_RESULTS);
export const inboxStatus = z.enum(INBOX_STATUSES);
export const contactStatus = z.enum(CONTACT_STATUSES);
export const suppressionReason = z.enum(SUPPRESSION_REASONS);
export const campaignStatus = z.enum(CAMPAIGN_STATUSES);
export const messageStatus = z.enum(MESSAGE_STATUSES);
export const trackedEmailSource = z.enum(TRACKED_EMAIL_SOURCES);
export const incomingEmailKind = z.enum(INCOMING_EMAIL_KINDS);
export const incomingKindFilter = z.enum(INCOMING_KIND_FILTERS);
export const clickVerdict = z.enum(CLICK_VERDICTS);
export const clickFilter = z.enum(CLICK_FILTERS);
export const sendingMode = z.enum(SENDING_MODES);

export type ProviderType = z.infer<typeof providerType>;
export type ZeptoRegion = z.infer<typeof zeptoRegion>;
export type ProviderStatus = z.infer<typeof providerStatus>;
export type SendFormat = z.infer<typeof sendFormat>;
export type DomainStatus = z.infer<typeof domainStatus>;
export type DnsCheckResult = z.infer<typeof dnsCheckResult>;
export type InboxStatus = z.infer<typeof inboxStatus>;
export type ContactStatus = z.infer<typeof contactStatus>;
export type SuppressionReason = z.infer<typeof suppressionReason>;
export type CampaignStatus = z.infer<typeof campaignStatus>;
export type MessageStatus = z.infer<typeof messageStatus>;
export type TrackedEmailSource = z.infer<typeof trackedEmailSource>;
export type IncomingEmailKind = z.infer<typeof incomingEmailKind>;
export type IncomingKindFilter = z.infer<typeof incomingKindFilter>;
export type ClickVerdict = z.infer<typeof clickVerdict>;
export type ClickFilter = z.infer<typeof clickFilter>;
export type SendingMode = z.infer<typeof sendingMode>;

export const pageMeta = {
	page: z.number(),
	limit: z.number(),
	total: z.number(),
};

export const nullableDate = z.string().nullable();
