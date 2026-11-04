import { z } from "zod";
import { OUTREACH } from "./outreach-config";

const errorEnvelope = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
});

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

const dataEnvelope = z.object({ data: z.unknown() });

export class OutreachError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "OutreachError";
		this.status = status;
		this.code = code;
	}
}

export type QueryValue = string | number | boolean | null | undefined;

export type OutreachRequest = {
	method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	query?: { [key: string]: QueryValue };
	json?: unknown;
	form?: FormData;
	signal?: AbortSignal;
};

export function outreachHref(
	path: string,
	query: { [key: string]: QueryValue } = {},
): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === "") continue;
		params.set(key, String(value));
	}
	const search = params.toString();
	return `${OUTREACH.proxy.crmPrefix}${path}${search ? `?${search}` : ""}`;
}

async function send(
	path: string,
	request: OutreachRequest,
): Promise<JsonValue> {
	const headers = new Headers();
	let body: BodyInit | undefined;

	if (request.form) {
		body = request.form;
	} else if (request.json !== undefined) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(request.json);
	}

	const response = await fetch(outreachHref(path, request.query), {
		method: request.method ?? "GET",
		headers,
		body,
		signal: request.signal,
		credentials: "same-origin",
	});

	const text = await response.text();
	let payload: JsonValue = null;
	if (text) {
		try {
			payload = JSON.parse(text);
		} catch {
			throw new OutreachError(
				response.status,
				"INVALID_RESPONSE",
				"Outreach sent a response that is not JSON.",
			);
		}
	}

	if (!response.ok) {
		const parsed = errorEnvelope.safeParse(payload);
		if (parsed.success) {
			throw new OutreachError(
				response.status,
				parsed.data.error.code,
				parsed.data.error.message,
			);
		}
		throw new OutreachError(
			response.status,
			"REQUEST_FAILED",
			`Outreach answered with status ${response.status}.`,
		);
	}

	return payload;
}

function parse<S extends z.ZodType>(
	schema: S,
	payload: JsonValue,
	path: string,
): z.infer<S> {
	const result = schema.safeParse(payload);
	if (!result.success) {
		throw new OutreachError(
			500,
			"UNEXPECTED_SHAPE",
			`Outreach returned an unexpected shape for ${path}: ${result.error.issues
				.slice(0, 3)
				.map((issue) => `${issue.path.join(".")} ${issue.message}`)
				.join("; ")}`,
		);
	}
	return result.data;
}

export async function outreachData<S extends z.ZodType>(
	path: string,
	schema: S,
	request: OutreachRequest = {},
): Promise<z.infer<S>> {
	const payload = await send(path, request);
	const envelope = parse(dataEnvelope, payload, path);
	const result = schema.safeParse(envelope.data);
	if (!result.success) {
		throw new OutreachError(
			500,
			"UNEXPECTED_SHAPE",
			`Outreach returned an unexpected shape for ${path}.`,
		);
	}
	return result.data;
}

export async function outreachPage<S extends z.ZodType>(
	path: string,
	schema: S,
	request: OutreachRequest = {},
): Promise<z.infer<S>> {
	return parse(schema, await send(path, request), path);
}

export async function outreachReachable(
	path: string,
	request: OutreachRequest = {},
): Promise<true> {
	await send(path, request);
	return true;
}
