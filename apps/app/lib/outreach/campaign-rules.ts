export const CAMPAIGN = {
	maxSubjectLength: 300,
	maxBodyLength: 20_000,
	maxVersions: 6,
	maxInboxes: 100,
	followUp: { minDays: 1, maxDays: 30, defaultDays: 3 },
	window: {
		lastStartMinute: 1439,
		endOfDayMinute: 1440,
		stepSeconds: 900,
		recommended: { startMinute: 600, endMinute: 1080, days: [1, 2, 3, 4, 5] },
	},
	previewDebounceMs: 400,
	autosaveDebounceMs: 900,
	previewContacts: 50,
	optOutLine: "Not relevant? Just reply 'no' and I won't email again.",
	standardVariables: ["firstName", "lastName", "company", "title", "email"],
	senderVariables: [
		"senderName",
		"senderRole",
		"senderEmail",
		"originalSubject",
	],
} as const;

export const DEFAULT_BODY_TEMPLATE = `Hi {{firstName|there}},\n\n\n\n${CAMPAIGN.optOutLine}`;

export const VARIABLE_LABELS = new Map<string, string>([
	["firstName", "First name"],
	["lastName", "Last name"],
	["company", "Company"],
	["title", "Job title"],
	["email", "Email"],
	["senderName", "Your name"],
	["senderRole", "Your role"],
	["senderEmail", "Your email"],
	["originalSubject", "First email's subject"],
]);

export const OPT_OUT_PATTERN =
	/won['’]?t email|unsubscribe|reply ['"“]?no['"”]?|opt[ -]?out/i;

export const INBOX = {
	maxDailyLimit: 200,
	warmUpAbove: 20,
	minGapSeconds: 120,
	maxGapSeconds: 24 * 60 * 60,
	defaults: { dailyLimit: 10, minGapSeconds: 480, maxGapSeconds: 900 },
} as const;
