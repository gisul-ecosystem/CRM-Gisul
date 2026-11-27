import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { REPLY_ALERTS } from "./reply-alerts.config";

const GRAPH = REPLY_ALERTS.graph;
const TIMEOUT = REPLY_ALERTS.tick.timeoutMs;

const tokenResponse = z.object({
	access_token: z.string().min(1),
	expires_in: z.coerce.number().positive(),
});

const tokenClaims = z.object({ roles: z.array(z.string()).nullish() });

const graphError = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
});

const sender = z
	.object({
		emailAddress: z.object({
			address: z.string().nullish(),
			name: z.string().nullish(),
		}),
	})
	.nullish();

export const inboxMessage = z.object({
	id: z.string(),
	conversationId: z.string().nullish(),
	isDraft: z.boolean().nullish(),
	from: sender,
	subject: z.string().nullish(),
	bodyPreview: z.string().nullish(),
	uniqueBody: z.object({ content: z.string().nullish() }).nullish(),
	receivedDateTime: z.string(),
	webLink: z.string().nullish(),
});

export type InboxMessage = z.infer<typeof inboxMessage>;

const messagePage = z.object({ value: z.array(inboxMessage) });

const threadPage = z.object({
	value: z.array(
		z.object({ id: z.string(), from: sender, isDraft: z.boolean().nullish() }),
	),
});

const emailAccounts = z.object({
	accounts: z.array(
		z.object({
			email: z.string(),
			status: z.string(),
			fromName: z.string().nullish(),
		}),
	),
});

export type SendingMailbox = { email: string; name: string | null };

type Credentials = { tenantId: string; clientId: string; clientSecret: string };

function env(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

export function senderOf(message: { from?: z.infer<typeof sender> }): string {
	return message.from?.emailAddress.address?.toLowerCase() ?? "";
}

export function odataQuoted(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

@Injectable()
export class TenantMailClient {
	private token: { value: string; expiresAt: number } | null = null;

	configured(): boolean {
		return (
			this.credentials() !== null && env(REPLY_ALERTS.env.unifersKey) !== null
		);
	}

	async mailboxes(): Promise<SendingMailbox[]> {
		const key = env(REPLY_ALERTS.env.unifersKey);
		if (!key) return [];
		const headers = new Headers({
			"x-api-key": key,
			accept: "application/json",
		});
		const workspace = env(REPLY_ALERTS.env.unifersWorkspace);
		if (workspace) headers.set("x-workspace-id", workspace);
		const base = (
			env(REPLY_ALERTS.env.unifersUrl) ?? REPLY_ALERTS.unifers.defaultUrl
		).replace(/\/+$/, "");
		const response = await fetch(
			`${base}${REPLY_ALERTS.unifers.accountsPath}`,
			{ headers, signal: AbortSignal.timeout(TIMEOUT) },
		);
		if (!response.ok) {
			throw new Error(
				`Unifers did not list its mailboxes (${response.status}).`,
			);
		}
		const parsed = emailAccounts.parse(await response.json());
		const byEmail = new Map<string, SendingMailbox>();
		for (const account of parsed.accounts) {
			if (account.status !== "verified") continue;
			const email = account.email.toLowerCase();
			if (!byEmail.has(email)) {
				byEmail.set(email, { email, name: account.fromName?.trim() || null });
			}
		}
		return [...byEmail.values()].slice(0, REPLY_ALERTS.maxMailboxes);
	}

	async inbox(mailbox: string, since: Date): Promise<InboxMessage[]> {
		const token = await this.tokenWith(GRAPH.readRoles, "Mail.Read");
		const params = new URLSearchParams({
			$filter: `receivedDateTime ge ${since.toISOString()}`,
			$orderby: "receivedDateTime desc",
			$select: GRAPH.fields,
			$top: String(GRAPH.pageSize),
		});
		const payload = await this.get(
			token,
			`${GRAPH.url}/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?${params.toString()}`,
		);
		return messagePage.parse(payload).value;
	}

	async weWroteIn(mailbox: string, conversationId: string): Promise<boolean> {
		const token = await this.tokenWith(GRAPH.readRoles, "Mail.Read");
		const params = new URLSearchParams({
			$filter: `conversationId eq ${odataQuoted(conversationId)}`,
			$select: GRAPH.threadFields,
			$top: String(GRAPH.threadMax),
		});
		const payload = await this.get(
			token,
			`${GRAPH.url}/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`,
		);
		const own = mailbox.toLowerCase();
		return threadPage
			.parse(payload)
			.value.some((message) => !message.isDraft && senderOf(message) === own);
	}

	async send(
		mailbox: string,
		to: readonly string[],
		subject: string,
		html: string,
	): Promise<void> {
		const token = await this.tokenWith(GRAPH.sendRoles, "Mail.Send");
		const response = await fetch(
			`${GRAPH.url}/users/${encodeURIComponent(mailbox)}/sendMail`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${token}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					message: {
						subject,
						body: { contentType: "HTML", content: html },
						toRecipients: to.map((address) => ({
							emailAddress: { address },
						})),
					},
					saveToSentItems: false,
				}),
				signal: AbortSignal.timeout(TIMEOUT),
			},
		);
		if (response.ok) return;
		throw new Error(await this.failure(response));
	}

	private credentials(): Credentials | null {
		const tenantId = env(REPLY_ALERTS.env.tenantId);
		const clientId = env(REPLY_ALERTS.env.clientId);
		const clientSecret = env(REPLY_ALERTS.env.clientSecret);
		if (!tenantId || !clientId || !clientSecret) return null;
		return { tenantId, clientId, clientSecret };
	}

	private async get(token: string, url: string): Promise<unknown> {
		const response = await fetch(url, {
			headers: {
				authorization: `Bearer ${token}`,
				prefer: 'outlook.body-content-type="text"',
			},
			signal: AbortSignal.timeout(TIMEOUT),
		});
		if (!response.ok) throw new Error(await this.failure(response));
		return response.json();
	}

	private async failure(response: Response): Promise<string> {
		const error = graphError.safeParse(await response.json().catch(() => null));
		return error.success
			? `${error.data.error.code}: ${error.data.error.message}`
			: `Microsoft answered ${response.status}.`;
	}

	private async tokenWith(
		needed: readonly string[],
		label: string,
	): Promise<string> {
		const token = await this.accessToken();
		const roles = this.roles(token);
		if (needed.some((role) => roles.includes(role))) return token;
		this.token = null;
		throw new Error(
			`The Microsoft app token has no ${label} application permission.`,
		);
	}

	private async accessToken(): Promise<string> {
		if (this.token && this.token.expiresAt > Date.now()) {
			return this.token.value;
		}
		const credentials = this.credentials();
		if (!credentials) throw new Error("Tenant mail is not configured.");
		const response = await fetch(
			`${GRAPH.loginUrl}/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`,
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: credentials.clientId,
					client_secret: credentials.clientSecret,
					scope: GRAPH.scope,
					grant_type: "client_credentials",
				}),
				signal: AbortSignal.timeout(TIMEOUT),
			},
		);
		const parsed = tokenResponse.safeParse(
			await response.json().catch(() => null),
		);
		if (!response.ok || !parsed.success) {
			throw new Error(
				`Microsoft refused the tenant sign-in (${response.status}).`,
			);
		}
		this.token = {
			value: parsed.data.access_token,
			expiresAt:
				Date.now() +
				parsed.data.expires_in * 1000 -
				REPLY_ALERTS.tick.tokenEarlyMs,
		};
		return this.token.value;
	}

	private roles(token: string): string[] {
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
}
