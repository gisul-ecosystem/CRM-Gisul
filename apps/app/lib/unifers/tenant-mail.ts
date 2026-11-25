import "server-only";
import { z } from "zod";
import { unifersKey, unifersUrl, unifersWorkspace } from "./bridge";
import { replyHtml, type TenantReply } from "./replies";
import { emailAccountsResponse } from "./schemas";
import { UNIFERS } from "./unifers-config";

const CONFIG = UNIFERS.tenantMail;

type Credentials = { tenantId: string; clientId: string; clientSecret: string };

export type SendingMailbox = { email: string; name: string | null };

const tokenResponse = z.object({
	access_token: z.string().min(1),
	expires_in: z.coerce.number().positive(),
});

const tokenClaims = z.object({
	roles: z.array(z.string()).nullish(),
});

const graphError = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
});

const graphMessage = z.object({
	id: z.string(),
	from: z
		.object({
			emailAddress: z.object({
				address: z.string().nullish(),
				name: z.string().nullish(),
			}),
		})
		.nullish(),
	subject: z.string().nullish(),
	bodyPreview: z.string().nullish(),
	uniqueBody: z.object({ content: z.string().nullish() }).nullish(),
	receivedDateTime: z.string(),
	webLink: z.string().nullish(),
});

const graphPage = z.object({
	value: z.array(graphMessage),
	"@odata.nextLink": z.string().nullish(),
});

let cachedToken: { value: string; expiresAt: number } | null = null;

function env(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

export function tenantMailCredentials(): Credentials | null {
	const tenantId = env(CONFIG.env.tenantId);
	const clientId = env(CONFIG.env.clientId);
	const clientSecret = env(CONFIG.env.clientSecret);
	if (!tenantId || !clientId || !clientSecret) return null;
	return { tenantId, clientId, clientSecret };
}

async function accessToken(credentials: Credentials): Promise<string> {
	if (cachedToken && cachedToken.expiresAt > Date.now()) {
		return cachedToken.value;
	}
	const response = await fetch(
		`${CONFIG.loginUrl}/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`,
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: credentials.clientId,
				client_secret: credentials.clientSecret,
				scope: CONFIG.scope,
				grant_type: "client_credentials",
			}),
			signal: AbortSignal.timeout(CONFIG.timeoutMs),
		},
	);
	const payload: unknown = await response.json().catch(() => null);
	const parsed = tokenResponse.safeParse(payload);
	if (!response.ok || !parsed.success) {
		throw new Error(
			`Microsoft refused the tenant sign-in (${response.status}). Check ${CONFIG.env.clientId} and ${CONFIG.env.clientSecret}.`,
		);
	}
	cachedToken = {
		value: parsed.data.access_token,
		expiresAt: Date.now() + parsed.data.expires_in * 1000 - CONFIG.tokenEarlyMs,
	};
	return cachedToken.value;
}

function tokenRoles(token: string): string[] {
	const payload = token.split(".")[1] ?? "";
	try {
		const json: unknown = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		);
		return tokenClaims.parse(json).roles ?? [];
	} catch {
		return [];
	}
}

export async function unifersMailboxes(): Promise<SendingMailbox[]> {
	const key = unifersKey();
	if (!key) return [];
	const headers = new Headers({ "x-api-key": key, accept: "application/json" });
	const workspace = unifersWorkspace();
	if (workspace) headers.set("x-workspace-id", workspace);
	const response = await fetch(
		`${unifersUrl()}${UNIFERS.proxy.upstreamPrefix}/email-accounts`,
		{ headers, signal: AbortSignal.timeout(CONFIG.timeoutMs) },
	);
	if (!response.ok) {
		throw new Error(`Unifers did not list its mailboxes (${response.status}).`);
	}
	const parsed = emailAccountsResponse.parse(await response.json());
	const sending = parsed.accounts.filter(
		(account) => account.status === "verified",
	);
	const byEmail = new Map<string, SendingMailbox>();
	for (const account of sending) {
		const email = account.email.toLowerCase();
		if (!byEmail.has(email)) {
			byEmail.set(email, { email, name: account.fromName?.trim() || null });
		}
	}
	return [...byEmail.values()].slice(0, CONFIG.maxMailboxes);
}

function firstPage(mailbox: string, since: string): string {
	const params = new URLSearchParams({
		$filter: `receivedDateTime ge ${since}`,
		$orderby: "receivedDateTime desc",
		$select: "id,from,subject,bodyPreview,uniqueBody,receivedDateTime,webLink",
		$top: String(CONFIG.pageSize),
	});
	return `${CONFIG.graphUrl}/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`;
}

async function mailboxReplies(
	token: string,
	mailbox: SendingMailbox,
	leads: ReadonlySet<string>,
	since: string,
): Promise<TenantReply[]> {
	const found = new Map<string, TenantReply>();
	let next: string | null = firstPage(mailbox.email, since);
	for (let page = 0; next && page < CONFIG.maxPages; page += 1) {
		const response = await fetch(next, {
			headers: {
				authorization: `Bearer ${token}`,
				prefer: 'outlook.body-content-type="text"',
			},
			signal: AbortSignal.timeout(CONFIG.timeoutMs),
		});
		const payload: unknown = await response.json().catch(() => null);
		if (!response.ok) {
			const error = graphError.safeParse(payload);
			throw new Error(
				error.success
					? `${error.data.error.code}: ${error.data.error.message}`
					: `Microsoft answered ${response.status}.`,
			);
		}
		const parsed = graphPage.parse(payload);
		for (const message of parsed.value) {
			const from = message.from?.emailAddress.address?.toLowerCase() ?? "";
			if (!leads.has(from) || found.has(from)) continue;
			const text = (
				message.uniqueBody?.content?.trim() ||
				message.bodyPreview?.trim() ||
				""
			).slice(0, CONFIG.maxText);
			found.set(from, {
				email: from,
				mailbox: mailbox.email,
				mailboxName: mailbox.name,
				messageId: message.id,
				subject: message.subject ?? null,
				text,
				sentAt: new Date(message.receivedDateTime).toISOString(),
				webLink: message.webLink ?? null,
			});
		}
		if (found.size === leads.size) break;
		next = parsed["@odata.nextLink"] ?? null;
	}
	return [...found.values()];
}

async function tokenWith(
	credentials: Credentials,
	needed: readonly string[],
	label: string,
): Promise<string> {
	const token = await accessToken(credentials);
	const roles = tokenRoles(token);
	if (needed.some((role) => roles.includes(role))) return token;
	cachedToken = null;
	throw new Error(
		`The Microsoft app signs in, but its token has no ${label} application permission (it has: ${roles.join(", ") || "none"}). In Entra, open the app → API permissions, add Microsoft Graph → Application permissions → ${label}, then click Grant admin consent.`,
	);
}

export async function sendTenantReply(
	credentials: Credentials,
	mailbox: string,
	messageId: string,
	text: string,
): Promise<void> {
	const token = await tokenWith(credentials, CONFIG.sendRoles, "Mail.Send");
	const response = await fetch(
		`${CONFIG.graphUrl}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}/reply`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ comment: replyHtml(text) }),
			signal: AbortSignal.timeout(CONFIG.timeoutMs),
		},
	);
	if (response.ok) return;
	const error = graphError.safeParse(await response.json().catch(() => null));
	throw new Error(
		error.success
			? `${error.data.error.code}: ${error.data.error.message}`
			: `Microsoft answered ${response.status}.`,
	);
}

export async function tenantReplies(
	credentials: Credentials,
	mailboxes: readonly SendingMailbox[],
	emails: readonly string[],
	since: string | null,
): Promise<{
	replies: TenantReply[];
	failed: { mailbox: string; reason: string }[];
}> {
	const token = await tokenWith(credentials, CONFIG.readRoles, "Mail.Read");
	const leads = new Set(emails.map((email) => email.toLowerCase()));
	const from = since ?? new Date(Date.now() - CONFIG.lookbackMs).toISOString();
	const results = await Promise.allSettled(
		mailboxes.map((mailbox) => mailboxReplies(token, mailbox, leads, from)),
	);
	const latest = new Map<string, TenantReply>();
	const failed: { mailbox: string; reason: string }[] = [];
	results.forEach((result, index) => {
		const mailbox = mailboxes[index]?.email ?? "";
		if (result.status === "rejected") {
			failed.push({
				mailbox,
				reason:
					result.reason instanceof Error
						? result.reason.message
						: String(result.reason),
			});
			return;
		}
		for (const reply of result.value) {
			const current = latest.get(reply.email);
			if (!current || current.sentAt < reply.sentAt) {
				latest.set(reply.email, reply);
			}
		}
	});
	return { replies: [...latest.values()], failed };
}
