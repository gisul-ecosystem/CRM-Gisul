import { db } from "@crm/db";
import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import {
	azureLanguageModel,
	azureStepSelection,
	defaultAzureDeployment,
} from "../../lib/azure-model";
import { attribute, purposeOf } from "../../lib/session-purpose";

export default defineAgent({
	description:
		"Execute one immutable deployed CRM agent version and persist its result and every side effect.",
	model: defineDynamic({
		fallback: azureLanguageModel(defaultAzureDeployment()),
		events: {
			"step.started": async (_event, ctx) => {
				if (purposeOf(ctx) !== "team-agent") return azureStepSelection();
				const runId = attribute(ctx, "runId");
				if (!runId) return azureStepSelection();

				const run = await db.agentRun.findUnique({
					where: { id: runId },
					select: {
						version: {
							select: { modelId: true, modelContextWindowTokens: true },
						},
					},
				});
				return run
					? {
							model: azureLanguageModel(run.version.modelId),
							modelContextWindowTokens: run.version.modelContextWindowTokens,
						}
					: azureStepSelection();
			},
		},
	}),
	outputSchema: z.object({
		summary: z.string().min(1).max(1000),
		result: z.record(z.string(), z.unknown()).nullable(),
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 40_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});
