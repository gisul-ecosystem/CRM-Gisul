export const AGENT_MODEL = {
	claude: {
		env: { apiKey: "ANTHROPIC_API_KEY", model: "ANTHROPIC_AGENT_MODEL" },
		model: "claude-haiku-5-5",
		effort: "low",
		contextWindowTokens: 100_000,
	},
} as const;
