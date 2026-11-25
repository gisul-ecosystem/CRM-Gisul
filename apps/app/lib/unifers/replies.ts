import { z } from "zod";
import { UNIFERS } from "./unifers-config";

export function campaignStart(createdAt: string | null): string | null {
	if (!createdAt) return null;
	const time = new Date(createdAt).getTime();
	return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export const tenantRepliesRequest = z.object({
	emails: z
		.array(z.string().trim().toLowerCase().pipe(z.email()))
		.min(1)
		.max(UNIFERS.tenantMail.maxLeads),
	since: z.iso.datetime({ offset: true }).nullable(),
});

export type TenantRepliesRequest = z.infer<typeof tenantRepliesRequest>;

export const tenantReply = z.object({
	email: z.string(),
	mailbox: z.string(),
	mailboxName: z.string().nullable(),
	messageId: z.string(),
	subject: z.string().nullable(),
	text: z.string(),
	sentAt: z.string(),
	webLink: z.string().nullable(),
});

export type TenantReply = z.infer<typeof tenantReply>;

export const tenantRepliesResponse = z.object({
	configured: z.boolean(),
	scope: z.enum(["all", "own"]),
	mailboxes: z.array(z.string()),
	replies: z.array(tenantReply),
	failed: z.array(z.object({ mailbox: z.string(), reason: z.string() })),
});

export type TenantRepliesResponse = z.infer<typeof tenantRepliesResponse>;

export const tenantSendRequest = z.object({
	mailbox: z.string().trim().toLowerCase().pipe(z.email()),
	messageId: z.string().trim().min(1),
	text: z.string().trim().min(1).max(UNIFERS.tenantMail.maxReplyChars),
});

export type TenantSendRequest = z.infer<typeof tenantSendRequest>;

export const tenantSendResponse = z.object({ sent: z.literal(true) });

export type ShownReply = {
	email: string;
	subject: string | null;
	text: string;
	sentAt: string;
	contactId: string | null;
	mailbox: string | null;
	mailboxName: string | null;
	messageId: string | null;
	webLink: string | null;
};

type SyncedReply = {
	email: string;
	contactId: string | null;
	subject: string | null;
	text: string;
	sentAt: string;
};

export function mergeReplies(
	tenant: readonly TenantReply[],
	synced: readonly SyncedReply[],
): Map<string, ShownReply> {
	const shown = new Map<string, ShownReply>();
	const contactOf = new Map(
		synced.map((reply) => [reply.email.toLowerCase(), reply.contactId]),
	);
	for (const reply of synced) {
		shown.set(reply.email.toLowerCase(), {
			...reply,
			email: reply.email.toLowerCase(),
			mailbox: null,
			mailboxName: null,
			messageId: null,
			webLink: null,
		});
	}
	for (const reply of tenant) {
		const email = reply.email.toLowerCase();
		const current = shown.get(email);
		if (current && current.sentAt > reply.sentAt) continue;
		shown.set(email, {
			...reply,
			email,
			contactId: contactOf.get(email) ?? null,
		});
	}
	return shown;
}

export function replyHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/\r?\n/g, "<br>");
}
