import { z } from "zod";

export const CONNECTION_TYPE_IDS = [
	"all_connections",
	"connections_search",
	"first_degree",
	"second_degree",
	"third_degree",
	"all_linkedin",
] as const;
export type ConnectionTypeId = (typeof CONNECTION_TYPE_IDS)[number];

export const FIRST_DEGREE_TYPES: readonly ConnectionTypeId[] = [
	"all_connections",
	"connections_search",
	"first_degree",
];

export const QUEUE_STATUSES = [
	"scraped",
	"queued",
	"sent",
	"failed",
	"skipped",
	"cleared",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const POST_DATE_WINDOWS = [
	"past-24h",
	"past-week",
	"past-month",
] as const;
export type PostDateWindow = (typeof POST_DATE_WINDOWS)[number];

export const JOB_STATUSES = [
	"idle",
	"running",
	"completed",
	"stopped",
	"failed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const text = z
	.string()
	.nullish()
	.transform((value) => value ?? "");
const count = z
	.number()
	.nullish()
	.transform((value) => value ?? 0);
const instant = z
	.string()
	.nullish()
	.transform((value) => value ?? null);

export const connectionType = z.object({
	label: z.string(),
	description: z.string(),
});

export const connectionTypes = z.record(
	z.enum(CONNECTION_TYPE_IDS),
	connectionType,
);
export type ConnectionTypes = z.infer<typeof connectionTypes>;

export const product = z.object({
	id: z.string(),
	name: z.string(),
	url: z.string(),
	tagline: z.string(),
	summary: z.string(),
	idealFor: z.array(z.string()),
	notIdealFor: z.array(z.string()),
});
export type Product = z.infer<typeof product>;

export const productsResponse = z.object({
	products: z.array(product),
	aiConfigured: z.boolean(),
	provider: z.enum(["claude", "openai", "none"]),
	rag: z.object({
		exists: z.boolean(),
		fresh: z.boolean(),
		builtAt: instant,
		chunkCount: count,
	}),
});
export type ProductsResponse = z.infer<typeof productsResponse>;

export const ragRebuild = z.object({
	ok: z.literal(true),
	chunkCount: count,
});

const logEntry = z.object({ at: z.string(), msg: z.string() });
export type LogEntry = z.infer<typeof logEntry>;

export const scrapeJob = z.object({
	status: z.enum(JOB_STATUSES),
	id: z.string().optional(),
	startedAt: instant,
	finishedAt: instant,
	processed: count,
	total: count,
	current: text,
	queued: count,
	skipped: count,
	sent: count,
	sendFailed: count,
	resultCount: count,
	error: text,
	stopRequested: z
		.boolean()
		.nullish()
		.transform((value) => value ?? false),
	logs: z.array(logEntry).default([]),
});
export type ScrapeJob = z.infer<typeof scrapeJob>;

export const sendJob = z.object({
	status: z.enum(JOB_STATUSES),
	id: z.string().optional(),
	startedAt: instant,
	finishedAt: instant,
	processed: count,
	total: count,
	current: text,
	sent: count,
	failed: count,
	logs: z.array(logEntry).default([]),
});
export type SendJob = z.infer<typeof sendJob>;

export const linkedInJob = z.object({
	status: z.enum(JOB_STATUSES),
	startedAt: instant,
	logs: z.array(z.string()).default([]),
});
export type LinkedInJob = z.infer<typeof linkedInJob>;

export const sendBudget = z.object({
	date: z.string(),
	timeZone: z.string(),
	limit: z.number(),
	sent: z.number(),
	remaining: z.number(),
	batchSize: z.number(),
	batchPauseMinutes: z.number(),
});
export type SendBudget = z.infer<typeof sendBudget>;

export const scraperStatus = z.object({
	linkedInConnected: z.boolean(),
	linkedInJob,
	scrapeJob,
	sendJob,
	sendBudget: sendBudget.nullable(),
	totalProfiles: z.number(),
	queueCount: z.number(),
	mongo: z.object({ ok: z.boolean(), db: z.string() }),
	inDocker: z.boolean(),
	browserViewerUrl: z.string(),
});
export type ScraperStatus = z.infer<typeof scraperStatus>;

export const scrapedProfile = z.object({
	slug: z.string(),
	profileUrl: text,
	name: text,
	headline: text,
	company: text,
	jobTitle: text,
	location: text,
	about: text,
	experience: text,
	education: text,
	connectionType: text,
	relevant: z
		.boolean()
		.nullish()
		.transform((value) => value ?? null),
	relevanceScore: z
		.number()
		.nullish()
		.transform((value) => value ?? null),
	matchSignals: z
		.array(z.string())
		.nullish()
		.transform((value) => value ?? []),
	recommendedProduct: text,
	productName: text,
	productUrl: text,
	sourcePost: z
		.object({
			url: text,
			text: text,
			postedAgo: text,
			keywords: text,
			intentScore: count,
			intentSignal: text,
			intentReason: text,
			foundAt: instant,
		})
		.nullish()
		.transform((value) => value ?? null),
	aiReason: text,
	aiMessage: text,
	lastMessage: text,
	queueStatus: z.enum(QUEUE_STATUSES).catch("scraped"),
	messageSent: z
		.boolean()
		.nullish()
		.transform((value) => value ?? false),
	messageSentAt: instant,
	messageError: text,
	scrapeError: text,
	scrapedAt: instant,
});
export type ScrapedProfile = z.infer<typeof scrapedProfile>;

export const resultsResponse = z.object({ profiles: z.array(scrapedProfile) });

export const queueResponse = z.object({
	items: z.array(scrapedProfile),
	count: z.number(),
});

export const queueItemResponse = z.object({ item: scrapedProfile });

export const jobHistoryEntry = z.object({
	jobId: z.string(),
	status: z.enum(JOB_STATUSES).catch("failed"),
	startedAt: instant,
	finishedAt: instant,
	processed: count,
	total: count,
	resultCount: count,
	queued: count,
	error: text,
	filters: z
		.object({
			connectionType: text,
			keywords: text,
			title: text,
			company: text,
			location: text,
		})
		.nullish()
		.transform(
			(value) =>
				value ?? {
					connectionType: "",
					keywords: "",
					title: "",
					company: "",
					location: "",
				},
		),
});
export type JobHistoryEntry = z.infer<typeof jobHistoryEntry>;

export const jobsResponse = z.object({ jobs: z.array(jobHistoryEntry) });

export const okMessage = z.object({
	ok: z.literal(true),
	message: text,
});

export const scrapeStarted = z.object({
	ok: z.literal(true),
	message: z.string(),
	previewUrl: text,
});

export const importStarted = z.object({
	ok: z.literal(true),
	message: z.string(),
	found: z.number(),
	willProcess: z.number(),
});

export const skipResult = z.object({
	ok: z.literal(true),
	skipped: z.number(),
});

export const clearResult = z.object({
	ok: z.literal(true),
	cleared: z.number(),
	message: z.string(),
});

export const sentSummary = z.object({
	date: z.string(),
	timeZone: z.string(),
	count: z.number(),
	budget: sendBudget,
	items: z.array(
		z.object({
			name: text,
			productName: text,
			messageSentAt: instant,
			profileUrl: text,
			message: text,
		}),
	),
});
export type SentSummary = z.infer<typeof sentSummary>;

export type PostSearch = {
	keywords: string;
	datePosted: PostDateWindow;
	maxPosts: number;
	products: string[];
	aiMessages: boolean;
	rescrape: boolean;
};

export type ScrapeFilters = {
	connectionType: ConnectionTypeId;
	keywords: string;
	title: string;
	company: string;
	location: string;
	profileUrl: string;
	maxResults: number;
	startIndex: number;
	products: string[];
	aiMessages: boolean;
	rescrape: boolean;
	sendMessages: boolean;
};
