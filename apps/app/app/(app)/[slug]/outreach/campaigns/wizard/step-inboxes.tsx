"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Link as TextLink } from "@crm/ui/components/link";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { OutreachStatus } from "@/components/outreach/status";
import { sendingApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { CAMPAIGN } from "@/lib/outreach/campaign-rules";
import { COUNT } from "@/lib/outreach/format";
import { INBOX_STATUS } from "@/lib/outreach/labels";
import type { WizardForm } from "@/lib/outreach/wizard";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function StepInboxes({
	form,
	onChange,
}: {
	form: WizardForm;
	onChange: (patch: Partial<WizardForm>) => void;
}) {
	const href = useWorkspaceUrl();
	const inboxes = useQuery({
		queryKey: [...outreachKeys.inboxes, "picker"],
		queryFn: () => sendingApi.inboxes({ page: 1, limit: CAMPAIGN.maxInboxes }),
	});

	if (form.followUpOf !== null) {
		return (
			<p className="max-w-xl rounded-lg border p-4 text-muted-foreground text-xs">
				A follow-up always goes from the inbox that sent the first email, so it
				stays in the same conversation. It uses the first campaign's inboxes.
			</p>
		);
	}

	const all = inboxes.data?.data ?? [];
	const selected = new Set(form.inboxIds);
	const chosen = all.filter((inbox) => selected.has(inbox.id));
	const capacity = chosen
		.filter((inbox) => inbox.status === "active")
		.reduce((sum, inbox) => sum + inbox.dailyLimit, 0);
	const notActive = chosen.filter((inbox) => inbox.status !== "active").length;
	const activeIds = all
		.filter((inbox) => inbox.status === "active")
		.map((inbox) => inbox.id);

	const toggle = (id: string) =>
		onChange({
			inboxIds: selected.has(id)
				? form.inboxIds.filter((existing) => existing !== id)
				: [...form.inboxIds, id],
		});

	if (inboxes.isPending) return <Skeleton className="h-40 w-full rounded-lg" />;

	if (all.length === 0) {
		return (
			<p className="text-muted-foreground text-xs">
				No sending inbox yet.{" "}
				<TextLink asChild>
					<NextLink href={href("/outreach/setup?tab=inboxes")}>
						Add an inbox
					</NextLink>
				</TextLink>{" "}
				first, then come back to this draft.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-xs">
					Emails are spread over the chosen inboxes. Each inbox sends at most
					its daily limit.
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onChange({ inboxIds: activeIds })}
				>
					Select all active
				</Button>
			</div>

			<SimpleTable
				columns={[
					{ id: "use", srLabel: "Use", width: "w-10" },
					{ id: "inbox", header: "Inbox" },
					{ id: "domain", header: "Domain" },
					{ id: "status", header: "Status" },
					{ id: "limit", header: "Daily limit", align: "right" },
				]}
			>
				{all.map((inbox) => (
					<SimpleTableRow
						key={inbox.id}
						clickable
						onClick={() => toggle(inbox.id)}
						data-state={selected.has(inbox.id) ? "selected" : undefined}
					>
						<TableCell className="px-3">
							<Checkbox
								checked={selected.has(inbox.id)}
								onCheckedChange={() => toggle(inbox.id)}
								onClick={(event) => event.stopPropagation()}
								aria-label={`Use ${inbox.email}`}
							/>
						</TableCell>
						<TableCell className="px-3">
							<p className="font-medium">{inbox.email}</p>
							{inbox.displayName ? (
								<p className="text-muted-foreground text-xs">
									{inbox.displayName}
								</p>
							) : null}
						</TableCell>
						<TableCell className="px-3 text-muted-foreground text-xs">
							{inbox.domainName}
						</TableCell>
						<TableCell className="px-3">
							<OutreachStatus status={INBOX_STATUS[inbox.status]} />
						</TableCell>
						<TableCell className="px-3 text-right tabular-nums">
							{inbox.dailyLimit}/day
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>

			<div className="rounded-lg border p-3 text-xs">
				<p className="font-medium">
					{chosen.length} inbox{chosen.length === 1 ? "" : "es"} selected ·
					daily capacity {COUNT.format(capacity)} emails
				</p>
				{notActive > 0 ? (
					<p className="text-muted-foreground">
						{notActive} selected inbox{notActive === 1 ? " is" : "es are"} not
						active and will not send until resumed. They are not counted above.
					</p>
				) : null}
			</div>
		</div>
	);
}
