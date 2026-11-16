import { z } from "zod";

export const LEAD_CATEGORIES = ["gpu", "training", "competitors"] as const;

export const leadCategory = z.enum(LEAD_CATEGORIES);

export type LeadCategory = z.infer<typeof leadCategory>;

export const LEAD_CATEGORY_LABEL = {
	gpu: "GPU lead",
	training: "Training lead",
	competitors: "Competitor client",
} as const satisfies Record<LeadCategory, string>;

export const LEAD_ORIGIN_KIND = "lead_origin";

export const LEAD_ORIGIN_LIMITS = {
	segment: 80,
	country: 60,
	signal: 300,
	source: 60,
} as const;

export const leadOriginDetails = z.object({
	segment: z.string().trim().max(LEAD_ORIGIN_LIMITS.segment).default(""),
	country: z.string().trim().max(LEAD_ORIGIN_LIMITS.country).default(""),
	signal: z.string().trim().max(LEAD_ORIGIN_LIMITS.signal).default(""),
	source: z.string().trim().max(LEAD_ORIGIN_LIMITS.source).default(""),
});

export type LeadOriginDetails = z.infer<typeof leadOriginDetails>;

export const leadOriginMeta = leadOriginDetails.extend({
	kind: z.literal(LEAD_ORIGIN_KIND),
	category: leadCategory,
});

export type LeadOriginMeta = z.infer<typeof leadOriginMeta>;
