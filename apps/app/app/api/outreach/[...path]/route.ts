import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import { connection } from "next/server";
import { bufferedProxyResponse } from "@/lib/api-proxy-response";
import {
	adminOnly,
	enginePath,
	forgetOutreachSession,
	outreachConfigured,
	outreachSession,
	outreachUrl,
} from "@/lib/outreach/bridge";
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
	return Response.json({ error: { code, message } }, { status });
}

async function handler(request: Request): Promise<Response> {
	await connection();

	const base = outreachUrl();
	if (!base || !outreachConfigured()) {
		return failure(
			503,
			"OUTREACH_NOT_CONFIGURED",
			"Outreach is not connected to this CRM. Set OUTREACH_URL, OUTREACH_EMAIL and OUTREACH_PASSWORD.",
		);
	}

	const session = await getSession();
	if (!session) return failure(401, "UNAUTHORIZED", "Please sign in.");

	const url = new URL(request.url);
	const path = enginePath(url.pathname);
	if (!path) return failure(404, "NOT_FOUND", "No such Outreach endpoint.");

	if (adminOnly(path, request.method)) {
		const role = await workspaceRoleOf(session.user.id, db);
		if (!isWorkspaceAdmin(role)) {
			return failure(
				403,
				"FORBIDDEN",
				"Only an owner or an admin can change the sending setup.",
			);
		}
	}

	const headers = new Headers(request.headers);
	for (const header of DROPPED_REQUEST_HEADERS) headers.delete(header);

	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: await request.arrayBuffer();

	const send = async (fresh: boolean): Promise<Response> => {
		const login = await outreachSession({ fresh });
		if (!login.ok) {
			return login.reason === "unreachable"
				? failure(
						502,
						"OUTREACH_UNREACHABLE",
						"The Outreach service did not answer. Check that it is running.",
					)
				: failure(
						502,
						"OUTREACH_LOGIN_FAILED",
						"Outreach refused the CRM's login. Check OUTREACH_EMAIL and OUTREACH_PASSWORD.",
					);
		}
		headers.set("cookie", login.cookie);
		try {
			return await fetch(`${base}${path}${url.search}`, {
				method: request.method,
				headers,
				body,
				redirect: "manual",
			});
		} catch {
			return failure(
				502,
				"OUTREACH_UNREACHABLE",
				"The Outreach service did not answer. Check that it is running.",
			);
		}
	};

	let upstream = await send(false);
	if (upstream.status === 401) {
		forgetOutreachSession();
		upstream = await send(true);
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
