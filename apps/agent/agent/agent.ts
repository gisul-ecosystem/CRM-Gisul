import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import {
	agentModelProvider,
	agentStepSelection,
	claudeModelId,
	defaultAgentModel,
} from "./lib/agent-model";
import { logCapabilities } from "./lib/capabilities";

void logCapabilities();

console.log(
	agentModelProvider() === "claude"
		? `[agent] model  Claude ${claudeModelId()} (ANTHROPIC_API_KEY)`
		: "[agent] model  Azure OpenAI (ANTHROPIC_API_KEY is unset)",
);

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

export default defineAgent({
	model: defineDynamic({
		fallback: defaultAgentModel(),
		events: { "step.started": () => agentStepSelection() },
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});
