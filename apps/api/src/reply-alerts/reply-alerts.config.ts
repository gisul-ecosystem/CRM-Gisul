const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export const REPLY_ALERTS = {
	env: {
		unifersKey: "UNIFERS_API_KEY",
		unifersUrl: "UNIFERS_API_URL",
		unifersWorkspace: "UNIFERS_WORKSPACE_ID",
		tenantId: "UNIFERS_MAIL_TENANT_ID",
		clientId: "UNIFERS_MAIL_CLIENT_ID",
		clientSecret: "UNIFERS_MAIL_CLIENT_SECRET",
	},
	unifers: {
		defaultUrl: "https://api.unifers.ai",
		accountsPath: "/client-apis/email-accounts",
	},
	graph: {
		loginUrl: "https://login.microsoftonline.com",
		url: "https://graph.microsoft.com/v1.0",
		scope: "https://graph.microsoft.com/.default",
		readRoles: ["Mail.Read", "Mail.ReadWrite"],
		sendRoles: ["Mail.Send"],
		fields:
			"id,conversationId,isDraft,from,subject,bodyPreview,uniqueBody,receivedDateTime,webLink",
		threadFields: "id,from,isDraft",
		pageSize: 50,
		threadMax: 50,
	},
	tick: {
		intervalMs: 2 * MINUTE_MS,
		firstRunMs: 30 * SECOND_MS,
		lookbackMs: 60 * MINUTE_MS,
		timeoutMs: 20 * SECOND_MS,
		tokenEarlyMs: MINUTE_MS,
	},
	email: {
		maxText: 3000,
		subjectPrefix: "Reply from",
	},
	maxMailboxes: 25,
	ignoredSenders: [
		"mailer-daemon",
		"postmaster",
		"noreply",
		"no-reply",
		"donotreply",
		"do-not-reply",
	],
} as const;
