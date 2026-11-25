import { z } from "zod";
import { LEADS_PIPELINE } from "./pipeline-config";

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

export class PipelineError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "PipelineError";
		this.status = status;
		this.code = code;
	}
}

type PipelineQueryValue =
	| string
	| number
	| boolean
	| readonly string[]
	| null
	| undefined;

export type PipelineQuery = { [key: string]: PipelineQueryValue };

type PipelineRequest = {
	method?: "GET" | "POST";
	query?: PipelineQuery;
	json?: unknown;
};

export function pipelineHref(path: string, query: PipelineQuery = {}): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (
			value === undefined ||
			value === null ||
			value === "" ||
			value === false
		)
			continue;
		if (Array.isArray(value)) {
			for (const item of value) params.append(key, item);
			continue;
		}
		params.set(key, value === true ? "1" : String(value));
	}
	const search = params.toString();
	return `${LEADS_PIPELINE.proxy.crmPrefix}${path}${search ? `?${search}` : ""}`;
}

function failureFrom(status: number, payload: JsonValue): PipelineError {
	const parsed = errorEnvelope.safeParse(payload);
	return new PipelineError(
		status,
		parsed.success ? (parsed.data.code ?? "REQUEST_FAILED") : "REQUEST_FAILED",
		parsed.success
			? parsed.data.error
			: `The lead generation pipeline answered with status ${status}.`,
	);
}

export async function pipelineJson<S extends z.ZodType>(
	path: string,
	schema: S,
	request: PipelineRequest = {},
): Promise<z.infer<S>> {
	const headers = new Headers();
	let body: string | undefined;
	if (request.json !== undefined) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(request.json);
	}

	const response = await fetch(pipelineHref(path, request.query), {
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
			throw new PipelineError(
				response.status,
				"INVALID_RESPONSE",
				"The lead generation pipeline sent a response that is not JSON.",
			);
		}
	}

	if (!response.ok) throw failureFrom(response.status, payload);

	const result = schema.safeParse(payload);
	if (!result.success) {
		throw new PipelineError(
			500,
			"UNEXPECTED_SHAPE",
			`The lead generation pipeline returned an unexpected shape for ${path}: ${result.error.issues
				.slice(0, 3)
				.map((issue) => `${issue.path.join(".")} ${issue.message}`)
				.join("; ")}`,
		);
	}
	return result.data;
}

export async function downloadFromPipeline(
	path: string,
	query: PipelineQuery = {},
): Promise<string> {
	const response = await fetch(pipelineHref(path, query), {
		credentials: "same-origin",
	});

	if (!response.ok) {
		throw failureFrom(
			response.status,
			await response
				.json()
				.then((value: JsonValue) => value)
				.catch(() => null),
		);
	}

	const disposition = response.headers.get("content-disposition") ?? "";
	const filename =
		/filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "leads.xlsx";
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
