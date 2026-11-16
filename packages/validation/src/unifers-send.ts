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
