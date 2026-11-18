export const AGENT_MODEL = {
	claude: {
		env: { apiKey: "ANTHROPIC_API_KEY", model: "ANTHROPIC_AGENT_MODEL" },
		model: "claude-opus-5-5",
		effort: "low",
		contextWindowTokens: 1_000_000,
	},
} as const;
