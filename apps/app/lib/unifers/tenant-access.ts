import "server-only";
import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import { unifersMailboxes } from "./tenant-mail";

export async function mailboxRefusal(
	user: { id: string; email: string },
	mailbox: string,
): Promise<string | null> {
	const sending = await unifersMailboxes();
	if (!sending.some((item) => item.email === mailbox)) {
		return `${mailbox} is not a verified Unifers sending mailbox.`;
	}
	const role = await workspaceRoleOf(user.id, db);
	if (!isWorkspaceAdmin(role) && mailbox !== user.email.toLowerCase()) {
		return "Only an owner or an admin can use another person's mailbox.";
	}
	return null;
}
