import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import { connection } from "next/server";
import { bufferedProxyResponse } from "@/lib/api-proxy-response";
import { getSession } from "@/lib/session";
import {
	adminOnly,
	unifersKey,
	unifersUrl,
	unifersWorkspace,
	upstreamPath,
} from "@/lib/unifers/bridge";

function failure(status: number, code: string, message: string): Response {
	return Response.json({ error: true, code, message }, { status });
}

function parseBody(raw: ArrayBuffer | undefined): unknown {
	if (!raw || raw.byteLength === 0) return null;
	try {
		return JSON.parse(new TextDecoder().decode(raw));
	} catch {
		return null;
	}
}

async function handler(request: Request): Promise<Response> {
	await connection();

	const key = unifersKey();
	if (!key) {
		return failure(
			503,
			"UNIFERS_NOT_CONFIGURED",
			"Unifers is not connected to this CRM. Set UNIFERS_API_KEY.",
		);
	}

	const session = await getSession();
	if (!session) return failure(401, "UNAUTHORIZED", "Please sign in.");

	const url = new URL(request.url);
	const path = upstreamPath(url.pathname);
	if (!path) return failure(404, "NOT_FOUND", "No such Unifers endpoint.");

	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: await request.arrayBuffer();

	if (adminOnly(path, request.method, parseBody(body))) {
		const role = await workspaceRoleOf(session.user.id, db);
		if (!isWorkspaceAdmin(role)) {
			return failure(
				403,
				"FORBIDDEN",
				"Only an owner or an admin can start, schedule, pause or cancel Unifers campaigns, or change sending mailboxes.",
			);
		}
	}

	const headers = new Headers({ "x-api-key": key, accept: "application/json" });
	if (body) headers.set("content-type", "application/json");
	const workspace = unifersWorkspace();
	if (workspace) headers.set("x-workspace-id", workspace);

	let upstream: Response;
	try {
		upstream = await fetch(`${unifersUrl()}${path}${url.search}`, {
			method: request.method,
			headers,
			body,
			redirect: "manual",
		});
	} catch {
		return failure(
			502,
			"UNIFERS_UNREACHABLE",
			"Unifers did not answer. Try again in a minute.",
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
