import "@crm/env/load";

import { createAzure } from "@ai-sdk/azure";
import {
	AZURE,
	azureOpenAiBase,
	contextWindowForAzureModel,
} from "@crm/db/azure-models";
import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { selectedModel } from "./model";

function azure() {
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
	const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
	const apiVersion =
		process.env.AZURE_OPENAI_API_VERSION?.trim() || AZURE.chatApiVersion;

	if (!endpoint || !apiKey) {
		return createAzure({ apiKey: apiKey || undefined, apiVersion });
	}

	return createAzure({
		baseURL: azureOpenAiBase(endpoint),
		apiKey,
		apiVersion,
	});
}

export function defaultAzureDeployment(): string {
	return process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || DEFAULT_AGENT_MODEL.id;
}

export function azureLanguageModel(deployment: string) {
	return azure()(deployment);
}

export async function azureStepSelection() {
	const selected = await selectedModel();
	if (selected && !selected.model.includes("/")) {
		return {
			model: azureLanguageModel(selected.model),
			modelContextWindowTokens: selected.modelContextWindowTokens,
		};
	}

	if (selected?.model.includes("/")) {
		console.error(
			`[agent] stored model "${selected.model}" is a Vercel gateway id. Using Azure deployment "${defaultAzureDeployment()}". Choose a deployment in Settings.`,
		);
	}

	const deployment = defaultAzureDeployment();
	return {
		model: azureLanguageModel(deployment),
		modelContextWindowTokens: contextWindowForAzureModel(deployment),
	};
}
