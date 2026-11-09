"use client";

import { useQuery } from "@tanstack/react-query";
import { pipelineApi } from "@/lib/leads-pipeline/api";
import { pipelineKeys } from "@/lib/leads-pipeline/cache";
import { LEADS_PIPELINE } from "@/lib/leads-pipeline/pipeline-config";
import type { LeadProfile } from "@/lib/leads-pipeline/schemas";
import { keyed } from "@/lib/outreach/format";

export function RunLog({
	profile,
	running,
}: {
	profile: LeadProfile;
	running: boolean;
}) {
	const log = useQuery({
		queryKey: pipelineKeys.log(profile),
		queryFn: () => pipelineApi.log(profile),
		refetchInterval: running
			? LEADS_PIPELINE.refresh.runningMs
			: LEADS_PIPELINE.refresh.idleMs,
	});

	if (log.isError) {
		return <p className="text-destructive text-xs">{log.error.message}</p>;
	}

	const lines = (log.data?.lines ?? [])
		.slice(-LEADS_PIPELINE.logLines)
		.reverse();

	if (lines.length === 0) {
		return (
			<p className="text-muted-foreground text-xs">
				{log.isPending ? "Loading…" : "No run has written to the log yet."}
			</p>
		);
	}

	return (
		<ol className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">
			{keyed(lines, "line").map(({ id, item }) => (
				<li key={id} className="min-w-0 break-words">
					{item}
				</li>
			))}
		</ol>
	);
}
