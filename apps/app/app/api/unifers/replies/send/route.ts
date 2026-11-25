import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import { connection } from "next/server";
import { getSession } from "@/lib/session";
import { tenantSendRequest } from "@/lib/unifers/replies";
import {
	sendTenantReply,
	tenantMailCredentials,
	unifersMailboxes,
} from "@/lib/unifers/tenant-mail";

function failure(status: number, code: string, message: string): Response {
	return Response.json({ error: true, code, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
	await connection();

	const session = await getSession();
	if (!session) return failure(401, "UNAUTHORIZED", "Please sign in.");

	const body = tenantSendRequest.safeParse(
		await request.json().catch(() => null),
	);
	if (!body.success) {
		return failure(400, "BAD_REQUEST", body.error.issues[0]?.message ?? "");
	}

	const credentials = tenantMailCredentials();
	if (!credentials) {
		return failure(
			503,
			"TENANT_MAIL_NOT_CONFIGURED",
			"Replying needs UNIFERS_MAIL_TENANT_ID, UNIFERS_MAIL_CLIENT_ID and UNIFERS_MAIL_CLIENT_SECRET.",
		);
	}

	const role = await workspaceRoleOf(session.user.id, db);
	const own = session.user.email.toLowerCase();
	const { mailbox, messageId, text } = body.data;

	try {
		const sending = await unifersMailboxes();
		if (!sending.some((item) => item.email === mailbox)) {
			return failure(
				403,
				"FORBIDDEN",
				`${mailbox} is not a verified Unifers sending mailbox.`,
			);
		}
		if (!isWorkspaceAdmin(role) && mailbox !== own) {
			return failure(
				403,
				"FORBIDDEN",
				"Only an owner or an admin can reply from another person's mailbox.",
			);
		}
		await sendTenantReply(credentials, mailbox, messageId, text);
		return Response.json({ sent: true });
	} catch (error) {
		return failure(
			502,
			"TENANT_MAIL_FAILED",
			error instanceof Error ? error.message : String(error),
		);
	}
}
