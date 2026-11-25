import { z } from "zod";
import { LINKEDIN_SCRAPER } from "./scraper-config";

const errorEnvelope = z.object({
	error: z.string(),
	code: z.string().optional(),
});

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export class ScraperError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "ScraperError";
		this.status = status;
		this.code = code;
	}
}

export type ScraperQueryValue = string | number | boolean | null | undefined;

export type ScraperRequest = {
	method?: "GET" | "POST" | "PATCH";
	query?: { [key: string]: ScraperQueryValue };
	json?: unknown;
	form?: FormData;
};

export function scraperHref(
	path: string,
	query: { [key: string]: ScraperQueryValue } = {},
): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === "") continue;
		params.set(key, String(value));
	}
	const search = params.toString();
	return `${LINKEDIN_SCRAPER.proxy.crmPrefix}${path}${search ? `?${search}` : ""}`;
}

async function send(path: string, request: ScraperRequest): Promise<JsonValue> {
	const headers = new Headers();
	let body: BodyInit | undefined;

	if (request.form) {
		body = request.form;
	} else if (request.json !== undefined) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(request.json);
	}

	const response = await fetch(scraperHref(path, request.query), {
		method: request.method ?? "GET",
		headers,
		body,
		credentials: "same-origin",
	});

	const raw = await response.text();
	let payload: JsonValue = null;
	if (raw) {
		try {
			payload = JSON.parse(raw);
		} catch {
			throw new ScraperError(
				response.status,
				"INVALID_RESPONSE",
				"The LinkedIn scraper sent a response that is not JSON.",
			);
		}
	}

	if (!response.ok) {
		const parsed = errorEnvelope.safeParse(payload);
		throw new ScraperError(
			response.status,
			parsed.success
				? (parsed.data.code ?? "REQUEST_FAILED")
				: "REQUEST_FAILED",
			parsed.success
				? parsed.data.error
				: `The LinkedIn scraper answered with status ${response.status}.`,
		);
	}

	return payload;
}

export async function scraperJson<S extends z.ZodType>(
	path: string,
	schema: S,
	request: ScraperRequest = {},
): Promise<z.infer<S>> {
	const payload = await send(path, request);
	const result = schema.safeParse(payload);
	if (!result.success) {
		throw new ScraperError(
			500,
			"UNEXPECTED_SHAPE",
			`The LinkedIn scraper returned an unexpected shape for ${path}: ${result.error.issues
				.slice(0, 3)
				.map((issue) => `${issue.path.join(".")} ${issue.message}`)
				.join("; ")}`,
		);
	}
	return result.data;
}

export async function downloadFromScraper(
	path: string,
	query: { [key: string]: ScraperQueryValue } = {},
): Promise<string> {
	const response = await fetch(scraperHref(path, query), {
		credentials: "same-origin",
	});

	if (!response.ok) {
		const parsed = errorEnvelope.safeParse(
			await response.json().catch(() => null),
		);
		throw new ScraperError(
			response.status,
			"DOWNLOAD_FAILED",
			parsed.success
				? parsed.data.error
				: `The download failed with status ${response.status}.`,
		);
	}

	const disposition = response.headers.get("content-disposition") ?? "";
	const filename =
		/filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "linkedin.xlsx";
	const url = URL.createObjectURL(await response.blob());
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return filename;
}
