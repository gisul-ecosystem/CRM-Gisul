import { z } from "zod";

export const REPLY_DRAFT_LIMITS = {
	name: 120,
	subject: 300,
	leadText: 2000,
	purpose: 600,
	body: 4000,
} as const;

const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const replyDraftRequest = z.object({
	leadName: optionalText(REPLY_DRAFT_LIMITS.name),
	senderName: optionalText(REPLY_DRAFT_LIMITS.name),
	subject: optionalText(REPLY_DRAFT_LIMITS.subject),
	leadText: z.string().trim().min(1).max(REPLY_DRAFT_LIMITS.leadText),
	purpose: optionalText(REPLY_DRAFT_LIMITS.purpose),
});

export type ReplyDraftRequest = z.infer<typeof replyDraftRequest>;

export const replyDraft = z.object({
	body: z.string().trim().min(1).max(REPLY_DRAFT_LIMITS.body),
});

export type ReplyDraft = z.infer<typeof replyDraft>;

export const replyDraftAnswer = z.discriminatedUnion("outcome", [
	z.object({ outcome: z.literal("drafted"), draft: replyDraft }),
	z.object({
		outcome: z.enum(["not_configured", "failed"]),
		reason: z.string(),
	}),
]);

export type ReplyDraftAnswer = z.infer<typeof replyDraftAnswer>;
