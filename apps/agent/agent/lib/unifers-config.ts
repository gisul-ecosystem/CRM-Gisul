const SECOND_MS = 1_000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;

export const UNIFERS = {
	defaultUrl: "https://api.unifers.ai",
	timeoutMs: 30 * SECOND_MS,

	paths: {
		enrich: "/client-apis/people/enrich/linkedin",
		reveal: "/client-apis/people/reveal/linkedin",
	},

	callCost: 2,
	useFallbackProvider: true,

	reveal: {
		repeatAfterMs: 30 * DAY_MS,
		usePersonalEmail: false,
		noteKind: "unifers_reveal",
	},
} as const;
