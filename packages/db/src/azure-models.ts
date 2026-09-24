const MINUTE_MS = 60_000;

export const AZURE = {
	defaultDeployment: "gpt-4o",
	defaultContextWindowTokens: 128_000,
	chatApiVersion: "v1",
	catalogApiVersion: "2024-10-21",
	catalog: {
		timeoutMs: 5_000,
		ttlMs: 30 * MINUTE_MS,
	},
} as const;

const CONTEXT_WINDOWS = [
	["gpt-4.1", 1_047_576],
	["gpt-4o", 128_000],
	["gpt-4-turbo", 128_000],
	["gpt-4", 128_000],
	["gpt-35", 16_385],
	["gpt-3.5", 16_385],
	["o4", 200_000],
	["o3", 200_000],
	["o1", 200_000],
] as const;

export function contextWindowForAzureModel(model: string): number {
	const name = model.trim().toLowerCase();
	for (const [prefix, tokens] of CONTEXT_WINDOWS) {
		if (name.startsWith(prefix)) return tokens;
	}
	return AZURE.defaultContextWindowTokens;
}

export function azureOpenAiBase(endpoint: string): string {
	const base = endpoint.trim().replace(/\/+$/, "");
	if (base.endsWith("/openai/v1")) return base;
	if (base.endsWith("/openai")) return `${base}/v1`;
	return `${base}/openai/v1`;
}
