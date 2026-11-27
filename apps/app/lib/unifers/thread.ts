import { z } from "zod";
import type { ThreadEntry, WaitingOn } from "./replies";
import { UNIFERS } from "./unifers-config";

const address = z
	.object({
		emailAddress: z.object({
			address: z.string().nullish(),
			name: z.string().nullish(),
		}),
	})
	.nullish();

export const graphMessage = z.object({
	id: z.string(),
	conversationId: z.string().nullish(),
	isDraft: z.boolean().nullish(),
	from: address,
	subject: z.string().nullish(),
	bodyPreview: z.string().nullish(),
	uniqueBody: z.object({ content: z.string().nullish() }).nullish(),
	receivedDateTime: z.string(),
	sentDateTime: z.string().nullish(),
	webLink: z.string().nullish(),
});

export type GraphMessage = z.infer<typeof graphMessage>;

export const graphPage = z.object({
	value: z.array(graphMessage),
	"@odata.nextLink": z.string().nullish(),
});

export function senderOf(message: GraphMessage): string {
	return message.from?.emailAddress.address?.toLowerCase() ?? "";
}

export function messageText(message: GraphMessage): string {
	return (
		message.uniqueBody?.content?.trim() ||
		message.bodyPreview?.trim() ||
		""
	).slice(0, UNIFERS.tenantMail.maxText);
}

export function waitingOnAfter(
	answered: ReadonlySet<string>,
	message: GraphMessage,
): WaitingOn {
	return message.conversationId && answered.has(message.conversationId)
		? "them"
		: "us";
}

function timeOf(message: GraphMessage): string {
	return new Date(
		message.sentDateTime ?? message.receivedDateTime,
	).toISOString();
}

export function threadEntries(
	messages: readonly GraphMessage[],
	mailbox: string,
): ThreadEntry[] {
	const own = mailbox.toLowerCase();
	return messages
		.filter((message) => !message.isDraft)
		.map(
			(message): ThreadEntry => ({
				id: message.id,
				direction: senderOf(message) === own ? "OUTBOUND" : "INBOUND",
				fromEmail: senderOf(message),
				fromName: message.from?.emailAddress.name?.trim() || null,
				subject: message.subject ?? null,
				text: messageText(message),
				sentAt: timeOf(message),
				webLink: message.webLink ?? null,
			}),
		)
		.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export function latestInbound(
	entries: readonly ThreadEntry[],
): ThreadEntry | null {
	return entries.findLast((entry) => entry.direction === "INBOUND") ?? null;
}

export function odataQuoted(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}
