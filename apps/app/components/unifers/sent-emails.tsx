"use client";

import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useQuery } from "@tanstack/react-query";
import { DetailSheetSection } from "@/components/detail-sheet";
import { LocalRelativeDate } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { campaignsApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import { engagementLine, sendStatus } from "@/lib/unifers/single-send";
import { UNIFERS } from "@/lib/unifers/unifers-config";

type Send = RouterOutputs["contacts"]["unifersSends"][number];

export function SentEmails({
	contactId,
	hasEmail,
}: {
	contactId: string;
	hasEmail: boolean;
}) {
	const trpc = useTRPC();
	const sends = useQuery(
		trpc.contacts.unifersSends.queryOptions({ id: contactId }),
	);

	if (sends.isError) {
		return (
			<DetailSheetSection title="Emails sent with Unifers">
				<p className="text-destructive text-xs">{sends.error.message}</p>
			</DetailSheetSection>
		);
	}

	if (!sends.data || sends.data.length === 0) {
		return (
			<DetailSheetSection title="Emails sent with Unifers">
				<p className="text-muted-foreground text-xs">
					{sends.isPending
						? "Loading…"
						: hasEmail
							? "No email sent yet. Click Send email at the top. Replies, opens and clicks show here."
							: "Add an email address to this contact to send with Unifers."}
				</p>
			</DetailSheetSection>
		);
	}

	return (
		<DetailSheetSection title="Emails sent with Unifers">
			<ul className="flex flex-col gap-3">
				{sends.data.map((send) => (
					<SentEmail key={send.id} send={send} />
				))}
			</ul>
		</DetailSheetSection>
	);
}

function SentEmail({ send }: { send: Send }) {
	const analytics = useQuery({
		queryKey: unifersKeys.analytics(send.campaignId),
		queryFn: () => campaignsApi.analytics(send.campaignId),
		refetchInterval: UNIFERS.refresh.listMs,
		retry: false,
	});
	const status = analytics.data
		? sendStatus(analytics.data, send.followUpAt)
		: null;

	return (
		<li className="flex flex-col gap-1">
			<div className="flex min-w-0 items-center justify-between gap-3">
				<span className="truncate font-medium">{send.subject}</span>
				{status ? (
					<StatusIndicator tone={status.tone} label={status.label} size="sm" />
				) : analytics.isError ? (
					<span className="text-destructive text-xs">
						{analytics.error.message}
					</span>
				) : (
					<span className="text-muted-foreground text-xs">Checking…</span>
				)}
			</div>
			{status ? (
				<p className="text-xs">{engagementLine(status.engagement)}</p>
			) : null}
			<p className="text-muted-foreground text-xs">
				From {send.sender} · <LocalRelativeDate date={send.sentAt} />
				{status?.followUp ? ` · ${status.followUp}` : ""}
			</p>
		</li>
	);
}
