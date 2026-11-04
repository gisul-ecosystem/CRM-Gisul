import { downloadFromScraper, scraperJson } from "./client";
import {
	clearResult,
	connectionTypes,
	importStarted,
	jobsResponse,
	okMessage,
	productsResponse,
	queueItemResponse,
	queueResponse,
	ragRebuild,
	resultsResponse,
	type ScrapeFilters,
	scraperStatus,
	scrapeStarted,
	sentSummary,
	skipResult,
} from "./schemas";

export const scraperApi = {
	status: () => scraperJson("/status", scraperStatus),
	connectionTypes: () => scraperJson("/connection-types", connectionTypes),
	products: () => scraperJson("/products", productsResponse),
	rebuildKnowledge: () =>
		scraperJson("/rag/rebuild", ragRebuild, { method: "POST" }),
};

export const linkedInApi = {
	connect: () =>
		scraperJson("/linkedin/connect", okMessage, { method: "POST" }),
	logout: () => scraperJson("/linkedin/logout", okMessage, { method: "POST" }),
	backToLinkedIn: () =>
		scraperJson("/linkedin/back", okMessage, { method: "POST" }),
};

export const scrapeApi = {
	start: (filters: ScrapeFilters) =>
		scraperJson("/scrape/start", scrapeStarted, {
			method: "POST",
			json: filters,
		}),
	importFile: (
		file: File,
		options: Pick<
			ScrapeFilters,
			"maxResults" | "startIndex" | "products" | "aiMessages" | "rescrape"
		>,
	) => {
		const form = new FormData();
		form.set("file", file);
		form.set("maxResults", String(options.maxResults));
		form.set("startIndex", String(options.startIndex));
		form.set("products", options.products.join(","));
		form.set("aiMessages", String(options.aiMessages));
		form.set("rescrape", String(options.rescrape));
		return scraperJson("/scrape/import", importStarted, {
			method: "POST",
			form,
		});
	},
	history: () => scraperJson("/jobs", jobsResponse),
};

export const profilesApi = {
	list: () => scraperJson("/results", resultsResponse),
	download: () => downloadFromScraper("/results/download"),
};

export const queueApi = {
	list: () => scraperJson("/queue", queueResponse),
	edit: (slug: string, message: string) =>
		scraperJson(`/queue/${encodeURIComponent(slug)}`, queueItemResponse, {
			method: "PATCH",
			json: { message },
		}),
	skip: (slugs: string[]) =>
		scraperJson("/queue/skip", skipResult, {
			method: "POST",
			json: { slugs },
		}),
	clear: (slugs: string[]) =>
		scraperJson("/queue/clear", clearResult, {
			method: "POST",
			json: { slugs },
		}),
	send: (slugs: string[]) =>
		scraperJson("/queue/send", okMessage, {
			method: "POST",
			json: { slugs },
		}),
};

export const reportsApi = {
	sentOn: (date: string) =>
		scraperJson("/reports/daily-sends/summary", sentSummary, {
			query: { date },
		}),
	downloadSentOn: (date: string) =>
		downloadFromScraper("/reports/daily-sends", { date }),
};
