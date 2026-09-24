import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import {
	azureLanguageModel,
	azureStepSelection,
	defaultAzureDeployment,
} from "./lib/azure-model";
import { logCapabilities } from "./lib/capabilities";

void logCapabilities();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

export default defineAgent({
	model: defineDynamic({
		fallback: azureLanguageModel(defaultAzureDeployment()),
		events: { "step.started": () => azureStepSelection() },
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});
