import "@crm/env/load";

import { createAnthropic } from "@ai-sdk/anthropic";
import { AGENT_MODEL } from "./agent-model-config";
import {
	azureLanguageModel,
	azureStepSelection,
	defaultAzureDeployment,
} from "./azure-model";

function claudeApiKey(): string | null {
	return process.env[AGENT_MODEL.claude.env.apiKey]?.trim() || null;
}

export function claudeModelId(): string {
	return (
		process.env[AGENT_MODEL.claude.env.model]?.trim() ||
		AGENT_MODEL.claude.model
	);
}

function claudeLanguageModel(apiKey: string) {
	return createAnthropic({ apiKey })(claudeModelId());
}

export function agentModelProvider(): "claude" | "azure" {
	return claudeApiKey() ? "claude" : "azure";
}

export function defaultAgentModel() {
	const apiKey = claudeApiKey();
	return apiKey
		? claudeLanguageModel(apiKey)
		: azureLanguageModel(defaultAzureDeployment());
}

export async function agentStepSelection() {
	const apiKey = claudeApiKey();
	if (!apiKey) return azureStepSelection();

	return {
		model: claudeLanguageModel(apiKey),
		modelContextWindowTokens: AGENT_MODEL.claude.contextWindowTokens,
		modelOptions: {
			providerOptions: { anthropic: { effort: AGENT_MODEL.claude.effort } },
		},
	};
}
