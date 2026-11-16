import { z } from "zod";
import { UNIFERS } from "./unifers-config";

const errorEnvelope = z.object({
	message: z.string(),
	code: z.string().optional(),
});

export class UnifersError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "UnifersError";
		this.status = status;
		this.code = code;
	}
}

type UnifersQuery = { [key: string]: string | number | undefined };

type UnifersRequest = {
	method?: "GET" | "POST" | "DELETE";
	query?: UnifersQuery;
	json?: unknown;
};

function href(path: string, query: UnifersQuery = {}): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === "") continue;
		params.set(key, String(value));
	}
	const search = params.toString();
	return `${UNIFERS.proxy.crmPrefix}${path}${search ? `?${search}` : ""}`;
}

export async function unifersJson<S extends z.ZodType>(
	path: string,
	schema: S,
	request: UnifersRequest = {},
): Promise<z.infer<S>> {
	const headers = new Headers();
	let body: string | undefined;
	if (request.json !== undefined) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(request.json);
	}

	const response = await fetch(href(path, request.query), {
		method: request.method ?? "GET",
		headers,
		body,
		credentials: "same-origin",
	});

	const payload: unknown = await response.json().catch(() => null);

	if (!response.ok) {
		const parsed = errorEnvelope.safeParse(payload);
		throw new UnifersError(
			response.status,
			parsed.success
				? (parsed.data.code ?? "REQUEST_FAILED")
				: "REQUEST_FAILED",
			parsed.success
				? parsed.data.message
				: `Unifers answered with status ${response.status}.`,
		);
	}

	const result = schema.safeParse(payload);
	if (!result.success) {
		throw new UnifersError(
			500,
			"UNEXPECTED_SHAPE",
			`Unifers returned an unexpected shape for ${path}: ${result.error.issues
				.slice(0, 3)
				.map((issue) => `${issue.path.join(".")} ${issue.message}`)
				.join("; ")}`,
		);
	}
	return result.data;
}
