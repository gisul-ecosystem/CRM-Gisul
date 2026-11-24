const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

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
	signOff: "Regards,\n{{sender.firstName}}",
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
		"{{sender.firstName}}",
	],
} as const;
