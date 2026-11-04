import { connection } from "next/server";
import { bufferedProxyResponse } from "@/lib/api-proxy-response";
import { scraperUrl, upstreamPath } from "@/lib/linkedin-scraper/bridge";
import { getSession } from "@/lib/session";

const DROPPED_REQUEST_HEADERS = [
	"host",
	"cookie",
	"authorization",
	"x-forwarded-host",
	"x-forwarded-proto",
	"x-forwarded-for",
	"forwarded",
	"transfer-encoding",
	"connection",
	"keep-alive",
	"content-length",
	"expect",
];

function failure(status: number, code: string, message: string): Response {
	return Response.json({ error: message, code }, { status });
}

async function handler(request: Request): Promise<Response> {
	await connection();

	const base = scraperUrl();
	if (!base) {
		return failure(
			503,
			"SCRAPER_NOT_CONFIGURED",
			"The LinkedIn scraper is not connected to this CRM. Set LINKEDIN_SCRAPER_URL.",
		);
	}

	const session = await getSession();
	if (!session) return failure(401, "UNAUTHORIZED", "Please sign in.");

	const url = new URL(request.url);
	const path = upstreamPath(url.pathname);
	if (!path) return failure(404, "NOT_FOUND", "No such scraper endpoint.");

	const headers = new Headers(request.headers);
	for (const header of DROPPED_REQUEST_HEADERS) headers.delete(header);

	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: await request.arrayBuffer();

	let upstream: Response;
	try {
		upstream = await fetch(`${base}${path}${url.search}`, {
			method: request.method,
			headers,
			body,
			redirect: "manual",
		});
	} catch {
		return failure(
			502,
			"SCRAPER_UNREACHABLE",
			"The LinkedIn scraper did not answer. Check that it is running.",
		);
	}

	const responseHeaders = new Headers(upstream.headers);
	responseHeaders.delete("set-cookie");

	return bufferedProxyResponse(upstream, responseHeaders, request.method);
}

export {
	handler as DELETE,
	handler as GET,
	handler as PATCH,
	handler as POST,
	handler as PUT,
};
