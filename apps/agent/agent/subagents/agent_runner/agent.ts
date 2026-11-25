import { db } from "@crm/db";
import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { agentStepSelection, defaultAgentModel } from "../../lib/agent-model";
import { azureLanguageModel } from "../../lib/azure-model";
import { attribute, purposeOf } from "../../lib/session-purpose";

export default defineAgent({
	description:
		"Execute one immutable deployed CRM agent version and persist its result and every side effect.",
	model: defineDynamic({
		fallback: defaultAgentModel(),
		events: {
			"step.started": async (_event, ctx) => {
				if (purposeOf(ctx) !== "team-agent") return agentStepSelection();
				const runId = attribute(ctx, "runId");
				if (!runId) return agentStepSelection();

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
					: agentStepSelection();
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
