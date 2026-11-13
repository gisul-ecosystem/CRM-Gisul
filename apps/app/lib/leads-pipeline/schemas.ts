import { z } from "zod";

export const LEAD_PROFILES = ["gpu", "training", "competitors"] as const;
export const LEAD_INTENTS = ["high", "medium", "low"] as const;

export const leadProfile = z.enum(LEAD_PROFILES);
export type LeadProfile = z.infer<typeof leadProfile>;
type LeadIntent = (typeof LEAD_INTENTS)[number];

const leadSummary = z.object({
	companies: z.number(),
	people: z.number(),
	emails: z.number(),
	valid: z.number(),
	ready: z.number(),
	intent: z.object({
		high: z.number(),
		medium: z.number(),
		low: z.number(),
	}),
});

const lastRun = z.object({
	started: z.string().nullable(),
	finished: z.string().nullable(),
	newCompanies: z.number(),
	newPeople: z.number(),
	newReady: z.number(),
});

const profileStatus = z.object({
	profile: leadProfile,
	label: z.string(),
	noun: z.string(),
	running: z.boolean(),
	ours: z.boolean(),
	updated: z.string().nullable(),
	summary: leadSummary,
	lastRun: lastRun.nullable(),
	runAt: z.string(),
	batch: z.number(),
	maxBatch: z.number(),
	sources: z.array(z.string()),
	dailySources: z.array(z.string()),
	segments: z.array(z.string()),
	countries: z.array(z.string()),
	intents: z.array(z.string()),
});

export const pipelineStatus = z.object({
	profiles: z.array(profileStatus),
});

export const runLog = z.object({
	profile: leadProfile,
	running: z.boolean(),
	lines: z.array(z.string()),
});

export const okMessage = z.object({
	ok: z.literal(true),
	message: z.string(),
});

export const lead = z.object({
	company: z.string(),
	domain: z.string(),
	company_linkedin: z.string(),
	country: z.string(),
	segment: z.string(),
	intent: z.string(),
	intent_score: z.string(),
	intent_signals: z.string(),
	early: z.string(),
	founded: z.string(),
	stage: z.string(),
	team_size: z.string(),
	source: z.string(),
	signal: z.string(),
	signal_url: z.string(),
	date_found: z.string(),
	full_name: z.string(),
	title: z.string(),
	linkedin_url: z.string(),
	email: z.string(),
	email_type: z.string(),
	verified_status: z.string(),
	phone: z.string(),
	score: z.string(),
	ready: z.string(),
	status: z.string(),
	last_updated: z.string(),
	find_people: z.string(),
});

export const leadsPage = z.object({
	profile: leadProfile,
	total: z.number(),
	page: z.number(),
	pageSize: z.number(),
	rows: z.array(lead),
});

const choice = z.object({
	options: z.array(z.string()),
	selected: z.array(z.string()),
});

export const pipelineSettings = z.object({
	profile: leadProfile,
	label: z.string(),
	flags: z.array(
		z.object({ key: z.string(), label: z.string(), on: z.boolean() }),
	),
	numbers: z.array(
		z.object({
			key: z.string(),
			label: z.string(),
			min: z.number(),
			max: z.number(),
			value: z.string(),
		}),
	),
	texts: z.array(
		z.object({ key: z.string(), label: z.string(), value: z.string() }),
	),
	secrets: z.array(
		z.object({ key: z.string(), label: z.string(), set: z.boolean() }),
	),
	segments: choice,
	countries: choice,
	sources: z.object({
		options: z.array(z.string()),
		skipped: z.array(z.string()),
	}),
	earlyExempt: choice.nullable(),
});

const customSearch = z.object({
	name: z.string(),
	slug: z.string(),
	what: z.array(z.string()),
	where: z.array(z.string()),
	mustHave: z.array(z.string()),
	exclude: z.array(z.string()),
	companies: z.number(),
	queries: z.array(z.string()),
	startedAt: z.string(),
	found: z.number().nullable(),
	searched: z
		.number()
		.nullish()
		.transform((value) => value ?? null),
});

export const customSearchList = z.object({
	profile: leadProfile,
	running: z.boolean(),
	searches: z.array(customSearch),
	limits: z.object({
		max_name_chars: z.number(),
		max_what: z.number(),
		max_where: z.number(),
		max_words: z.number(),
		max_term_chars: z.number(),
		max_queries: z.number(),
		max_companies: z.number(),
		default_companies: z.number(),
	}),
});

export const customSearchPreview = z.object({
	queries: z.array(z.string()),
	slug: z.string(),
	maxQueries: z.number(),
});

export type CustomSearch = z.infer<typeof customSearch>;
export type CustomSearchList = z.infer<typeof customSearchList>;

export type CustomSearchInput = {
	profile: LeadProfile;
	name: string;
	what: string[];
	where: string[];
	mustHave: string[];
	exclude: string[];
	companies: number;
};

export type ProfileStatus = z.infer<typeof profileStatus>;
export type PipelineStatus = z.infer<typeof pipelineStatus>;
export type Lead = z.infer<typeof lead>;
export type PipelineSettings = z.infer<typeof pipelineSettings>;

export type LeadFilters = {
	q: string;
	ready: boolean;
	hasEmail: boolean;
	intent: LeadIntent | null;
	segment: string | null;
	country: string | null;
	source: string | null;
	latest: boolean;
	perCompany: boolean;
};

export type SettingsUpdate = {
	profile: LeadProfile;
	flags: { [key: string]: boolean };
	numbers: { [key: string]: string };
	texts: { [key: string]: string };
	secrets: { [key: string]: string };
	clearSecrets: string[];
	segments: string[];
	countries: string[];
	skipSources: string[];
	earlyExempt: string[];
};
