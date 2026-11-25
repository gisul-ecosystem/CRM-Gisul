import { z } from "zod";

export const LEAD_CATEGORIES = [
	"gpu",
	"training",
	"competitors",
	"partners",
] as const;

export const leadCategory = z.enum(LEAD_CATEGORIES);

export type LeadCategory = z.infer<typeof leadCategory>;

export const LEAD_CATEGORY_LABEL = {
	gpu: "GPU lead",
	training: "Training lab lead",
	competitors: "Competitor client",
	partners: "Partner research",
} as const satisfies Record<LeadCategory, string>;

export const LEAD_ORIGIN_KIND = "lead_origin";

export const LEAD_ORIGIN_LIMITS = {
	segment: 80,
	country: 60,
	signal: 300,
	source: 60,
	companySize: 60,
	opener: 400,
	evidence: 4,
	evidenceTitle: 240,
	evidenceUrl: 500,
	evidenceField: 120,
} as const;

const originText = (max: number) => z.string().trim().max(max).default("");

export const leadOriginEvidence = z.object({
	title: originText(LEAD_ORIGIN_LIMITS.evidenceTitle),
	url: originText(LEAD_ORIGIN_LIMITS.evidenceUrl),
	source: originText(LEAD_ORIGIN_LIMITS.evidenceField),
	date: originText(LEAD_ORIGIN_LIMITS.evidenceField),
	agency: originText(LEAD_ORIGIN_LIMITS.evidenceField),
	value: originText(LEAD_ORIGIN_LIMITS.evidenceField),
});

export type LeadOriginEvidence = z.infer<typeof leadOriginEvidence>;

export const leadOriginDetails = z.object({
	segment: z.string().trim().max(LEAD_ORIGIN_LIMITS.segment).default(""),
	country: z.string().trim().max(LEAD_ORIGIN_LIMITS.country).default(""),
	signal: z.string().trim().max(LEAD_ORIGIN_LIMITS.signal).default(""),
	source: z.string().trim().max(LEAD_ORIGIN_LIMITS.source).default(""),
	companySize: originText(LEAD_ORIGIN_LIMITS.companySize),
	opener: originText(LEAD_ORIGIN_LIMITS.opener),
	evidence: z
		.array(leadOriginEvidence)
		.max(LEAD_ORIGIN_LIMITS.evidence)
		.default([]),
});

export type LeadOriginDetails = z.infer<typeof leadOriginDetails>;

export const leadOriginMeta = leadOriginDetails.extend({
	kind: z.literal(LEAD_ORIGIN_KIND),
	category: leadCategory,
});

export type LeadOriginMeta = z.infer<typeof leadOriginMeta>;

export function leadCategoryOf(meta: unknown): LeadCategory | null {
	const parsed = leadOriginMeta.safeParse(meta);
	return parsed.success ? parsed.data.category : null;
}
