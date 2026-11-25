import { z } from "zod";
import { leadCategory } from "./lead-origin";

export const CAMPAIGN_DRAFT_LIMITS = {
	purpose: 600,
	steps: 8,
	listName: 120,
	samples: 8,
	sample: 80,
	placeholders: 10,
	placeholder: 60,
	subject: 200,
	body: 6000,
} as const;

const PLACEHOLDER = /^\{\{[^{}]+\}\}$/;

export const campaignDraftRequest = z.object({
	productId: z.string().trim().min(1).nullable(),
	category: leadCategory.nullable(),
	purpose: z.string().trim().max(CAMPAIGN_DRAFT_LIMITS.purpose).nullable(),
	steps: z.number().int().min(1).max(CAMPAIGN_DRAFT_LIMITS.steps),
	includeLink: z.boolean(),
	audience: z.object({
		name: z.string().trim().max(CAMPAIGN_DRAFT_LIMITS.listName).nullable(),
		titles: z
			.array(z.string().trim().min(1).max(CAMPAIGN_DRAFT_LIMITS.sample))
			.max(CAMPAIGN_DRAFT_LIMITS.samples),
		companies: z
			.array(z.string().trim().min(1).max(CAMPAIGN_DRAFT_LIMITS.sample))
			.max(CAMPAIGN_DRAFT_LIMITS.samples),
	}),
	placeholders: z
		.array(
			z
				.string()
				.trim()
				.max(CAMPAIGN_DRAFT_LIMITS.placeholder)
				.regex(PLACEHOLDER),
		)
		.min(1)
		.max(CAMPAIGN_DRAFT_LIMITS.placeholders),
});

export type CampaignDraftRequest = z.infer<typeof campaignDraftRequest>;

export const campaignDraftStep = z.object({
	subject: z.string().trim().min(1).max(CAMPAIGN_DRAFT_LIMITS.subject),
	body: z.string().trim().min(1).max(CAMPAIGN_DRAFT_LIMITS.body),
});

export const campaignDraft = z.object({
	steps: z.array(campaignDraftStep).min(1).max(CAMPAIGN_DRAFT_LIMITS.steps),
});

export type CampaignDraft = z.infer<typeof campaignDraft>;

export const campaignDraftAnswer = z.discriminatedUnion("outcome", [
	z.object({ outcome: z.literal("drafted"), draft: campaignDraft }),
	z.object({
		outcome: z.enum(["not_configured", "failed"]),
		reason: z.string(),
	}),
]);

export type CampaignDraftAnswer = z.infer<typeof campaignDraftAnswer>;
