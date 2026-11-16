import { z } from "zod";

export const EMAIL_DRAFT_LIMITS = {
	purpose: 600,
	senderName: 120,
	subject: 200,
	body: 8000,
} as const;

export const emailDraftRequest = z.object({
	contactId: z.string().trim().min(1),
	productId: z.string().trim().min(1).nullable(),
	senderName: z.string().trim().max(EMAIL_DRAFT_LIMITS.senderName).nullable(),
	purpose: z.string().trim().max(EMAIL_DRAFT_LIMITS.purpose).nullable(),
});

export type EmailDraftRequest = z.infer<typeof emailDraftRequest>;

export const emailDraft = z.object({
	subject: z.string().trim().min(1).max(EMAIL_DRAFT_LIMITS.subject),
	body: z.string().trim().min(1).max(EMAIL_DRAFT_LIMITS.body),
	followUpBody: z.string().trim().min(1).max(EMAIL_DRAFT_LIMITS.body),
});

export type EmailDraft = z.infer<typeof emailDraft>;

export const emailDraftAnswer = z.discriminatedUnion("outcome", [
	z.object({ outcome: z.literal("drafted"), draft: emailDraft }),
	z.object({
		outcome: z.enum(["not_configured", "not_found", "failed"]),
		reason: z.string(),
	}),
]);

export type EmailDraftAnswer = z.infer<typeof emailDraftAnswer>;
