"use client";

import { LocalDateTime } from "@/components/local-date-time";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { keyed, TIME_ONLY } from "@/lib/outreach/format";

export type JobLogLine = { at: string | null; msg: string };

export function JobLog({ entries }: { entries: readonly JobLogLine[] }) {
	const recent = entries.slice(-LINKEDIN_SCRAPER.logLines).reverse();

	if (recent.length === 0) {
		return <p className="text-muted-foreground text-xs">No activity yet.</p>;
	}

	return (
		<ol className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">
			{keyed(recent, "log").map(({ id, item: entry }) => (
				<li key={id} className="flex gap-3">
					{entry.at ? (
						<span className="shrink-0 text-muted-foreground tabular-nums">
							<LocalDateTime date={entry.at} options={TIME_ONLY} />
						</span>
					) : null}
					<span className="min-w-0 break-words">{entry.msg}</span>
				</li>
			))}
		</ol>
	);
}
