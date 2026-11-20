const SECOND_MS = 1000;

export const EMAIL_DRAFT = {
	env: { apiKey: "ANTHROPIC_API_KEY", model: "ANTHROPIC_EMAIL_MODEL" },
	model: "claude-haiku-5-5",
	effort: "low",
	maxTokens: 16000,
	timeoutMs: 90 * SECOND_MS,
	fallbackBeta: "server-side-fallback-2026-07-01",
	noFallbackModelPrefix: "claude-haiku-",
	brief: { maxChars: 2500 },
	company: { maxDescriptionChars: 800 },
	product: { maxDescriptionChars: 1200 },
	body: { maxWords: 140 },
	followUp: { maxWords: 80 },
} as const;
