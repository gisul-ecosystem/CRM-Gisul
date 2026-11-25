import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import { connection } from "next/server";
import { getSession } from "@/lib/session";
import {
	type TenantRepliesResponse,
	tenantRepliesRequest,
} from "@/lib/unifers/replies";
import {
	tenantMailCredentials,
	tenantReplies,
	unifersMailboxes,
} from "@/lib/unifers/tenant-mail";

function failure(status: number, code: string, message: string): Response {
	return Response.json({ error: true, code, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
	await connection();

	const session = await getSession();
	if (!session) return failure(401, "UNAUTHORIZED", "Please sign in.");

	const body = tenantRepliesRequest.safeParse(
		await request.json().catch(() => null),
	);
	if (!body.success) {
		return failure(400, "BAD_REQUEST", body.error.issues[0]?.message ?? "");
	}

	const role = await workspaceRoleOf(session.user.id, db);
	const scope = isWorkspaceAdmin(role) ? "all" : "own";
	const credentials = tenantMailCredentials();

	if (!credentials) {
		const empty: TenantRepliesResponse = {
			configured: false,
			scope,
			mailboxes: [],
			replies: [],
			failed: [],
		};
		return Response.json(empty);
	}

	try {
		const all = await unifersMailboxes();
		const own = session.user.email.toLowerCase();
		const mailboxes =
			scope === "all" ? all : all.filter((mailbox) => mailbox === own);
		const result = mailboxes.length
			? await tenantReplies(
					credentials,
					mailboxes,
					body.data.emails,
					body.data.since,
				)
			: { replies: [], failed: [] };
		const answer: TenantRepliesResponse = {
			configured: true,
			scope,
			mailboxes,
			...result,
		};
		return Response.json(answer);
	} catch (error) {
		return failure(
			502,
			"TENANT_MAIL_FAILED",
			error instanceof Error ? error.message : String(error),
		);
	}
}
