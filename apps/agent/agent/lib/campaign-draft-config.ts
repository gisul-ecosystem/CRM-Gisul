const SECOND_MS = 1000;

export const CAMPAIGN_DRAFT = {
	model: "claude-haiku-5-5",
	effort: "low",
	maxTokensPerStep: 450,
	timeoutMs: 60 * SECOND_MS,
	product: { maxDescriptionChars: 400 },
	body: { firstMaxWords: 110, followUpMaxWords: 60 },
} as const;

export const REPLY_DRAFT = {
	model: "claude-haiku-5-5",
	effort: "low",
	maxTokens: 300,
	maxWords: 90,
	leadMaxChars: 1200,
	timeoutMs: 45 * SECOND_MS,
} as const;
