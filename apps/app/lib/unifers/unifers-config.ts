const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const UNIFERS = {
	proxy: {
		crmPrefix: "/api/unifers",
		upstreamPrefix: "/client-apis",
		allowedRoots: ["email-accounts", "campaigns"],
	},
	defaultUrl: "https://api.unifers.ai",
	routePrefix: "u-",
	refresh: {
		listMs: MINUTE_MS,
		activeMs: 15 * SECOND_MS,
	},
	pageSize: 25,
	pickerSize: 100,
	overview: { maxCampaigns: 50 },
	leadsPageSize: 50,
	maxLeadsPerCall: 1000,
	audienceFetchLimit: 100,
	maxSteps: 8,
	defaultTimeZone: "Asia/Kolkata",
	defaultWindow: { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
	followUpWaitDays: 3,
	singleSend: {
		namePrefix: "Email to",
		window: { start: "00:00", end: "23:59", days: [1, 2, 3, 4, 5, 6, 7] },
		stopConditions: { onReply: true, onClick: false },
		minFollowUpDays: 1,
	},
	signOff: "Regards,",
	footer: { maxChars: 500, storageKey: "unifers.campaign.footer" },
	tenantMail: {
		env: {
			tenantId: "UNIFERS_MAIL_TENANT_ID",
			clientId: "UNIFERS_MAIL_CLIENT_ID",
			clientSecret: "UNIFERS_MAIL_CLIENT_SECRET",
		},
		loginUrl: "https://login.microsoftonline.com",
		graphUrl: "https://graph.microsoft.com/v1.0",
		scope: "https://graph.microsoft.com/.default",
		readRoles: ["Mail.Read", "Mail.ReadWrite"],
		sendRoles: ["Mail.Send"],
		maxReplyChars: 4000,
		lookbackMs: 30 * DAY_MS,
		pageSize: 50,
		maxPages: 6,
		maxMailboxes: 25,
		maxLeads: 50,
		maxText: 2000,
		timeoutMs: 20 * SECOND_MS,
		tokenEarlyMs: MINUTE_MS,
	},
	senderPlaceholder: "{{sender.",
	draft: {
		sampleSize: 100,
		maxSamples: 5,
		firstName: "{{firstName | there}}",
		company: "{{company.name | your team}}",
	},
	placeholders: [
		"{{firstName | there}}",
		"{{fullName}}",
		"{{jobTitle}}",
		"{{company.name}}",
	],
} as const;
