"use client";

import { Badge } from "@crm/ui/components/badge";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { campaignsApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import { UNIFERS_CAMPAIGN_STATUS } from "@/lib/unifers/labels";
import { unifersRouteId } from "@/lib/unifers/sender";
import { UNIFERS } from "@/lib/unifers/unifers-config";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function UnifersCampaignsTable() {
	const href = useWorkspaceUrl();
	const router = useRouter();
	const [page, setPage] = useState(1);
	const { pageSize } = UNIFERS;
	const offset = (page - 1) * pageSize;

	const campaigns = useQuery({
		queryKey: unifersKeys.campaigns(offset),
		queryFn: () => campaignsApi.list(offset),
		placeholderData: (previous) => previous,
		refetchInterval: UNIFERS.refresh.listMs,
	});

	if (campaigns.isPending) {
		return <Skeleton className="h-48 w-full rounded-lg" />;
	}
	if (campaigns.isError) {
		return (
			<p className="text-destructive text-xs">{campaigns.error.message}</p>
		);
	}

	const rows = campaigns.data.campaigns;
	const total = campaigns.data.total;

	if (rows.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyTitle>No Unifers campaigns yet</EmptyTitle>
					<EmptyDescription>
						Click New campaign and choose Send with Unifers.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<SimpleTable
				columns={[
					{ id: "name", header: "Campaign" },
					{ id: "status", header: "Status" },
					{ id: "leads", header: "Leads", align: "right" },
					{ id: "senders", header: "Senders" },
					{ id: "created", header: "Created" },
				]}
			>
				{rows.map((row) => {
					const status = UNIFERS_CAMPAIGN_STATUS[row.status];
					return (
						<SimpleTableRow
							key={row.id}
							clickable
							onClick={() =>
								router.push(
									href(`/outreach/campaigns/${unifersRouteId(row.id)}`),
								)
							}
						>
							<TableCell className="max-w-72 px-3">
								<span className="flex min-w-0 items-center gap-2">
									<span className="truncate">{row.name}</span>
									<Badge variant="outline">Unifers</Badge>
								</span>
								{row.lastError ? (
									<p className="truncate text-destructive text-xs">
										{row.lastError}
									</p>
								) : null}
							</TableCell>
							<TableCell className="px-3">
								<StatusIndicator
									tone={status.tone}
									label={status.label}
									size="sm"
								/>
							</TableCell>
							<TableCell className="px-3 text-right tabular-nums">
								{COUNT.format(row.leadCount)}
							</TableCell>
							<TableCell className="max-w-56 truncate px-3 text-muted-foreground text-xs">
								{row.senders.join(", ") || "Default mailbox"}
							</TableCell>
							<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
								{row.createdAt ? (
									<LocalDateTime date={row.createdAt} options={DATE_TIME} />
								) : (
									"—"
								)}
							</TableCell>
						</SimpleTableRow>
					);
				})}
			</SimpleTable>
			{total > pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(total / pageSize)}
					pageSize={pageSize}
					total={total}
					onPageChange={setPage}
					loading={campaigns.isFetching}
				/>
			) : null}
		</div>
	);
}
