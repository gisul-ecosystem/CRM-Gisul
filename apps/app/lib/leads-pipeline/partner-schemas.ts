import { z } from "zod";

export const PARTNER_COMPANY_TYPES = ["listed", "sme"] as const;
export const PARTNER_SIZE_FITS = ["yes", "maybe", "unknown", "no"] as const;
export const PARTNER_RUN_STATUSES = [
	"running",
	"done",
	"failed",
	"stopped",
] as const;

const option = z.object({ id: z.string(), label: z.string() });

const partnerRun = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	startedAt: z.string(),
	finishedAt: z.string().nullable(),
	status: z.enum(PARTNER_RUN_STATUSES),
	countries: z.array(z.string()),
	sectors: z.array(z.string()),
	signals: z.array(z.string()),
	queries: z.number(),
	searched: z.number(),
	cached: z.number(),
	found: z.number(),
	modelUsed: z.boolean(),
	tokens: z.number(),
	sizeUnknown: z.number().default(0),
	sizeTooBig: z.number().default(0),
	unifersCredits: z.number().default(0),
});

export const partnerOverview = z.object({
	running: z.boolean(),
	searchReady: z.boolean(),
	modelReady: z.boolean(),
	unifersReady: z.boolean().default(false),
	options: z.object({
		countries: z.array(z.string()),
		sectors: z.array(option),
		signals: z.array(option.extend({ countries: z.array(z.string()) })),
		months: z.array(z.number()),
		sizes: z.array(option),
	}),
	limits: z.object({
		max_name_chars: z.number(),
		max_words: z.number(),
		max_past_work_chars: z.number(),
		max_queries: z.number(),
		max_companies: z.number(),
		default_companies: z.number(),
		default_months: z.number(),
		default_size: z.string(),
		unifers_max_people: z.number().default(0),
		unifers_repeat_days: z.number().default(0),
		unifers_manual_max: z.number().default(0),
	}),
	runs: z.array(partnerRun),
});

export const partnerPreview = z.object({
	queries: z.array(z.string()),
	datasets: z.array(z.string()),
	maxQueries: z.number(),
});

const partnerPerson = z.object({
	name: z.string(),
	title: z.string(),
	linkedin: z.string(),
	headline: z.string().default(""),
	location: z.string().default(""),
	employer: z.string().default(""),
	email: z.string().default(""),
	phone: z.string().default(""),
	enriched: z.boolean().default(false),
	worksThere: z.boolean().nullable().default(null),
	added: z.boolean().default(false),
});

const partnerEvidence = z.object({
	title: z.string(),
	url: z.string(),
	source: z.string(),
	date: z.string(),
	signal: z.string(),
	agency: z.string(),
	value: z.string(),
});

const partnerRow = z.object({
	key: z.string(),
	company: z.string(),
	country: z.string(),
	domain: z.string(),
	size: z.string().default(""),
	sizeFit: z.enum(PARTNER_SIZE_FITS).default("unknown"),
	companyLinkedin: z.string().default(""),
	companyType: z.enum(PARTNER_COMPANY_TYPES),
	contactLevel: z.string(),
	signals: z.array(z.string()),
	sectors: z.array(z.string()),
	agencies: z.array(z.string()),
	value: z.string(),
	valueUsd: z.number().default(0),
	sizeLow: z.number().nullable().default(null),
	sizeHigh: z.number().nullable().default(null),
	date: z.string(),
	score: z.number(),
	people: z.array(partnerPerson),
	why: z.string(),
	hook: z.string(),
	polished: z.boolean(),
	evidence: z.array(partnerEvidence),
	runId: z.string().default(""),
	runName: z.string().default(""),
	runAt: z.string().default(""),
});

export const partnerResults = z.object({
	id: z.string(),
	rows: z.array(partnerRow),
});

export const partnerEnrichResult = z.object({
	rows: z.array(partnerRow),
	credits: z.number(),
	lookedUp: z.number(),
	fromCache: z.number(),
	notes: z.array(z.string()),
});

export type PartnerEnrichItem = { run: string; key: string; linkedin: string };

export const partnerLog = z.object({
	running: z.boolean(),
	lines: z.array(z.string()),
});

export type PartnerOverview = z.infer<typeof partnerOverview>;
export type PartnerRun = z.infer<typeof partnerRun>;
export type PartnerRow = z.infer<typeof partnerRow>;
export type PartnerPerson = z.infer<typeof partnerPerson>;

export type PartnerSearchInput = {
	name: string;
	countries: string[];
	sectors: string[];
	signals: string[];
	months: number;
	pastWork: string;
	mustHave: string[];
	exclude: string[];
	companies: number;
	useModel: boolean;
	enrichContacts: boolean;
	size: string;
	keepUnknownSize: boolean;
};
