import { z } from "zod";

export const CAMPAIGN_STATUSES = [
	"draft",
	"scheduled",
	"active",
	"paused",
	"completed",
	"cancelled",
	"archived",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ACCOUNT_STATUSES = [
	"pending",
	"verified",
	"failed",
	"revoked",
	"disconnected",
] as const;

export const LEAD_EVENTS = [
	"sent",
	"delivered",
	"opened",
	"clicked",
	"replied",
] as const;
export type LeadEvent = (typeof LEAD_EVENTS)[number];

export const CAMPAIGN_ACTIONS = ["start", "pause", "cancel"] as const;
export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[number];

export const DUPLICATE_RULES = [
	"this_campaign",
	"active_campaigns",
	"any_campaign",
] as const;
export type DuplicateRule = (typeof DUPLICATE_RULES)[number];

const text = z
	.string()
	.nullish()
	.transform((value) => value ?? null);

export const emailAccount = z.object({
	email: z.string(),
	provider: z.string(),
	fromName: text,
	replyTo: text,
	status: z.enum(ACCOUNT_STATUSES).catch("pending"),
	isDefault: z
		.boolean()
		.nullish()
		.transform((value) => value ?? false),
	lastError: text,
	connectedAt: text,
});
export type EmailAccount = z.infer<typeof emailAccount>;

export const emailAccountsResponse = z.object({
	accounts: z.array(emailAccount),
});

export const connectAccountResponse = z.object({
	account: emailAccount.nullish().transform((value) => value ?? null),
	authUrl: text,
	created: z.boolean().nullish(),
});

export const disconnectResponse = z.object({ disconnected: z.string() });

const sendWindow = z.object({
	start: text,
	end: text,
	days: z
		.array(z.number())
		.nullish()
		.transform((value) => value ?? []),
	timeZone: text,
});

export const campaign = z.object({
	id: z.number(),
	name: z.string(),
	status: z.enum(CAMPAIGN_STATUSES).catch("draft"),
	senders: z
		.array(z.string())
		.nullish()
		.transform((value) => value ?? []),
	sendWindow: sendWindow.nullish().transform((value) => value ?? null),
	stopConditions: z
		.object({
			onReply: z.boolean().nullish(),
			onClick: z.boolean().nullish(),
		})
		.nullish()
		.transform((value) => value ?? { onReply: true, onClick: false }),
	leadCount: z
		.number()
		.nullish()
		.transform((value) => value ?? 0),
	scheduledStartAt: text,
	launchedAt: text,
	completedAt: text,
	lastError: text,
	createdAt: text,
	updatedAt: text,
});
export type Campaign = z.infer<typeof campaign>;

export const campaignsResponse = z.object({
	campaigns: z.array(campaign),
	total: z.number(),
});

export const leadsResult = z.object({
	received: z.number(),
	added: z.number(),
	alreadyInCampaign: z.number(),
	inOtherCampaign: z.number(),
	rejected: z.array(
		z.object({
			index: z.number(),
			email: text,
			message: z.string(),
			code: text,
		}),
	),
});
export type LeadsResult = z.infer<typeof leadsResult>;

export const createCampaignResponse = z.object({
	campaign,
	leads: leadsResult.nullish().transform((value) => value ?? null),
});

export const addLeadsResponse = z.object({ leads: leadsResult });

export const campaignResponse = z.object({ campaign });

export const campaignLeadsResponse = z.object({
	leads: z.array(
		z.object({
			email: z.string(),
			name: z
				.string()
				.nullish()
				.transform((value) => value ?? ""),
			steps: z
				.array(z.string())
				.nullish()
				.transform((value) => value ?? []),
		}),
	),
	total: z.number(),
});

const emailCounts = z.object({
	sent: z.number(),
	delivered: z.number(),
	opened: z.number(),
	clicked: z.number(),
	replied: z.number(),
	bounced: z.number(),
	totalOpens: z.number(),
	totalClicks: z.number(),
});

export const analyticsResponse = z.object({
	campaign,
	leads: z.object({
		total: z.number(),
		enrolled: z.number(),
		active: z.number(),
		completed: z.number(),
		exited: z.number(),
		failed: z.number(),
		paused: z.number(),
	}),
	email: emailCounts.extend({
		rates: z.object({
			deliveredPctOfSent: z.number(),
			bouncedPctOfSent: z.number(),
			openedPctOfDelivered: z.number(),
			clickedPctOfDelivered: z.number(),
			repliedPctOfDelivered: z.number(),
		}),
	}),
	steps: z.array(
		z.object({
			id: z.string(),
			type: z.string(),
			subject: text,
			wait: text,
			waiting: z.number(),
			ended: z.number(),
			email: emailCounts.nullish().transform((value) => value ?? null),
		}),
	),
});
export type CampaignAnalytics = z.infer<typeof analyticsResponse>;

export type SequenceStep = { subject: string; body: string; waitDays: number };

export type NewCampaign = {
	name: string;
	senders: string[];
	sequence: SequenceStep[];
	sendWindow: { start: string; end: string; days: number[]; timeZone: string };
	stopConditions: { onReply: boolean; onClick: boolean };
	startAt?: string;
	leads?: UnifersLead[];
};

export type UnifersLead = {
	email: string;
	fullName?: string;
	companyName?: string;
	linkedinUrl?: string;
};

export type SmtpConnection = {
	provider: "smtp";
	email: string;
	fromName: string;
	password: string;
	smtp: { host: string; port: number };
	imap: { host: string; port: number };
};
