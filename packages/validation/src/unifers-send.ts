import { z } from "zod";

export const UNIFERS_SEND_PROVIDER = "unifers";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const unifersSendMeta = z.object({
	provider: z.literal(UNIFERS_SEND_PROVIDER),
	campaignId: z.number().int().positive(),
	sender: z.string().trim().min(1),
	followUpAt: day.nullable(),
});

export type UnifersSendMeta = z.infer<typeof unifersSendMeta>;

export const unifersSendInput = z.object({
	contactId: z.string().trim().min(1),
	campaignId: z.number().int().positive(),
	sender: z.string().trim().min(1),
	subject: z.string().trim().min(1),
	body: z.string().trim().min(1),
	followUpAt: day.nullable(),
});

export type UnifersSendInput = z.infer<typeof unifersSendInput>;

export const unifersSend = z.object({
	id: z.string(),
	subject: z.string(),
	sentAt: z.string(),
	campaignId: z.number().int().positive(),
	sender: z.string(),
	followUpAt: day.nullable(),
});

export type UnifersSend = z.infer<typeof unifersSend>;

export const UNIFERS_REPLY_LIMITS = {
	emails: 50,
	perLead: 5,
	text: 2000,
} as const;

export const unifersRepliesInput = z.object({
	emails: z
		.array(z.string().trim().toLowerCase().pipe(z.email()))
		.min(1)
		.max(UNIFERS_REPLY_LIMITS.emails),
	since: z.iso.datetime({ offset: true }).nullable(),
});

export type UnifersRepliesInput = z.infer<typeof unifersRepliesInput>;

export const unifersReply = z.object({
	email: z.string(),
	contactId: z.string().nullable(),
	subject: z.string().nullable(),
	text: z.string(),
	sentAt: z.string(),
});

export type UnifersReply = z.infer<typeof unifersReply>;

export const UNIFERS_REPLY_SCOPES = ["all", "own"] as const;

export const unifersReplies = z.object({
	scope: z.enum(UNIFERS_REPLY_SCOPES),
	replies: z.array(unifersReply),
});

export type UnifersReplies = z.infer<typeof unifersReplies>;
