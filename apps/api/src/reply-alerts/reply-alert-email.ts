import { REPLY_ALERTS } from "./reply-alerts.config";

export type ReplyAlertContent = {
	fromEmail: string;
	fromName: string | null;
	mailbox: string;
	subject: string | null;
	text: string;
	receivedAt: Date;
	crmUrl: string;
	outlookUrl: string | null;
};

const WHEN = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "UTC",
});

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function who(content: ReplyAlertContent): string {
	return content.fromName
		? `${content.fromName} (${content.fromEmail})`
		: content.fromEmail;
}

export function replyAlertSubject(content: ReplyAlertContent): string {
	const topic = content.subject?.trim() || "(no subject)";
	return `${REPLY_ALERTS.email.subjectPrefix} ${who(content)}: ${topic}`;
}

export function replyAlertHtml(content: ReplyAlertContent): string {
	const text = escapeHtml(
		content.text.trim().slice(0, REPLY_ALERTS.email.maxText) || "(empty)",
	).replace(/\r?\n/g, "<br>");
	const links = [
		`<a href="${escapeHtml(content.crmUrl)}">Open in the CRM</a>`,
		content.outlookUrl
			? `<a href="${escapeHtml(content.outlookUrl)}">Open in Outlook</a>`
			: null,
	].filter((link) => link !== null);
	return [
		`<p><b>${escapeHtml(who(content))}</b> replied to ${escapeHtml(content.mailbox)}.</p>`,
		`<p>Subject: ${escapeHtml(content.subject?.trim() || "(no subject)")}<br>Received: ${WHEN.format(content.receivedAt)} UTC</p>`,
		`<blockquote style="margin:0;padding-left:12px;border-left:3px solid #ccc">${text}</blockquote>`,
		`<p>${links.join(" · ")}</p>`,
		"<p>Answer from the CRM so the reply goes from the same mailbox, in the same thread.</p>",
	].join("\n");
}
