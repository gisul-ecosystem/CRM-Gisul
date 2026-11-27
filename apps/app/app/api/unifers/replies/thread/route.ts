import { connection } from "next/server";
import { getSession } from "@/lib/session";
import {
	type TenantThreadResponse,
	tenantThreadRequest,
} from "@/lib/unifers/replies";
import { mailboxRefusal } from "@/lib/unifers/tenant-access";
import { tenantMailCredentials, tenantThread } from "@/lib/unifers/tenant-mail";

function failure(status: number, code: string, message: string): Response {
	return Response.json({ error: true, code, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
	await connection();

	const session = await getSession();
	if (!session) return failure(401, "UNAUTHORIZED", "Please sign in.");

	const body = tenantThreadRequest.safeParse(
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
			"Reading a conversation needs UNIFERS_MAIL_TENANT_ID, UNIFERS_MAIL_CLIENT_ID and UNIFERS_MAIL_CLIENT_SECRET.",
		);
	}

	const { mailbox, messageId } = body.data;

	try {
		const refusal = await mailboxRefusal(session.user, mailbox);
		if (refusal) return failure(403, "FORBIDDEN", refusal);
		const answer: TenantThreadResponse = {
			messages: await tenantThread(credentials, mailbox, messageId),
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
