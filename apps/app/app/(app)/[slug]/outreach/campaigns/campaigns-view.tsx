"use client";

import Add from "@carbon/icons-react/es/Add";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { Link as TextLink } from "@crm/ui/components/link";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { Meter } from "@/components/outreach/meter";
import { OutreachPage } from "@/components/outreach/outreach-page";
import { OutreachStatus } from "@/components/outreach/status";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { campaignApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { campaignProgress, isEditable } from "@/lib/outreach/campaign-progress";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { CAMPAIGN_STATUS } from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { Campaign } from "@/lib/outreach/schemas/campaign";
import {
	CAMPAIGN_STATUSES,
	type CampaignStatus,
} from "@/lib/outreach/schemas/enums";
import { useDebounced } from "@/lib/outreach/use-debounced";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type StatusFilter = CampaignStatus | typeof ALL;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: ALL, label: "All statuses" },
	...CAMPAIGN_STATUSES.map((status) => ({
		value: status,
		label: CAMPAIGN_STATUS[status].label,
	})),
];

export function CampaignsView() {
	const href = useWorkspaceUrl();

	return (
		<OutreachPage
			title="Campaigns"
			description="Each campaign emails one list from your sending inboxes, inside its sending window."
			actions={
				<Button asChild>
					<NextLink href={href("/outreach/campaigns/new")}>
						<Icon icon={Add} data-icon="inline-start" />
						New campaign
					</NextLink>
				</Button>
			}
		>
			<CampaignsTable />
		</OutreachPage>
	);
}

function CampaignsTable() {
	const href = useWorkspaceUrl();
	const router = useRouter();
	const cache = useOutreachCache();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>(ALL);
	const [toDelete, setToDelete] = useState<Campaign | null>(null);
	const query = useDebounced(search.trim());

	const campaigns = useQuery({
		queryKey: [...outreachKeys.campaigns, "list", { page, query, status }],
		queryFn: () =>
			campaignApi.list({
				page,
				limit: OUTREACH.pageSize,
				search: query || undefined,
				status: status === ALL ? undefined : status,
			}),
		placeholderData: (previous) => previous,
		refetchInterval: OUTREACH.refresh.campaignMs,
	});

	const pauseResume = useMutation({
		mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" }) =>
			action === "pause" ? campaignApi.pause(id) : campaignApi.resume(id),
		onSuccess: async (campaign) => {
			await cache.campaigns(campaign.id);
			toast.success(
				campaign.status === "paused"
					? `“${campaign.name}” paused.`
					: `“${campaign.name}” resumed.`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => campaignApi.remove(id),
		onSuccess: async () => {
			await cache.campaigns();
			setToDelete(null);
			toast.success("Campaign deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const rows = campaigns.data?.data ?? [];
	const total = campaigns.data?.total ?? 0;
	const filtered = Boolean(query) || status !== ALL;

	return (
		<div className="flex flex-col gap-4">
			<OutreachToolbar>
				<SearchBox
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
					placeholder="Search campaigns"
				/>
				<FilterSelect
					value={status}
					onChange={(value) => {
						setStatus(value);
						setPage(1);
					}}
					options={STATUS_OPTIONS}
					label="Filter by status"
				/>
			</OutreachToolbar>

			{campaigns.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : campaigns.isError ? (
				<p className="text-destructive text-xs">{campaigns.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{filtered ? "No matching campaigns" : "No campaigns yet"}
						</EmptyTitle>
						<EmptyDescription>
							{filtered
								? "Change the search or the status filter."
								: "Create a campaign to email a list from your sending inboxes."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "name", header: "Campaign" },
						{ id: "status", header: "Status" },
						{ id: "progress", header: "Progress", width: "w-60" },
						{ id: "created", header: "Created" },
						{ id: "actions", srLabel: "Actions", width: "w-12" },
					]}
				>
					{rows.map((campaign) => {
						const { done, target } = campaignProgress(campaign);
						const opens =
							campaign.status === "draft"
								? `/outreach/campaigns/${campaign.id}/edit`
								: `/outreach/campaigns/${campaign.id}`;
						return (
							<SimpleTableRow key={campaign.id}>
								<TableCell className="px-3">
									<TextLink asChild variant="quiet">
										<NextLink href={href(opens)} className="font-medium">
											{campaign.name}
										</NextLink>
									</TextLink>
									<p className="text-muted-foreground text-xs">
										{campaign.listName ?? "—"}
										{campaign.followUpOf ? " · Follow-up" : ""}
									</p>
								</TableCell>
								<TableCell className="px-3">
									<OutreachStatus
										status={CAMPAIGN_STATUS[campaign.status]}
										pulse={campaign.status === "running"}
									/>
								</TableCell>
								<TableCell className="px-3">
									{campaign.status === "draft" ? (
										<span className="text-muted-foreground text-xs">
											Not started
										</span>
									) : (
										<div className="flex flex-col gap-1">
											<Meter
												value={done}
												max={target}
												label={`${campaign.name} progress`}
											/>
											<span className="text-muted-foreground text-xs tabular-nums">
												{COUNT.format(done)} / {COUNT.format(target)} sent
												{campaign.counts.failed > 0
													? ` · ${COUNT.format(campaign.counts.failed)} failed`
													: ""}
											</span>
										</div>
									)}
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									<LocalDateTime
										date={campaign.createdAt}
										options={DATE_TIME}
									/>
								</TableCell>
								<TableCell className="px-3">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Actions for ${campaign.name}`}
											>
												<Icon icon={OverflowMenuHorizontal} />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onSelect={() =>
													router.push(
														href(`/outreach/campaigns/${campaign.id}`),
													)
												}
											>
												Open
											</DropdownMenuItem>
											{isEditable(campaign) ? (
												<DropdownMenuItem
													onSelect={() =>
														router.push(
															href(`/outreach/campaigns/${campaign.id}/edit`),
														)
													}
												>
													{campaign.status === "draft"
														? "Continue setup"
														: "Edit"}
												</DropdownMenuItem>
											) : null}
											{campaign.status === "running" ? (
												<DropdownMenuItem
													onSelect={() =>
														pauseResume.mutate({
															id: campaign.id,
															action: "pause",
														})
													}
												>
													Pause
												</DropdownMenuItem>
											) : null}
											{campaign.status === "paused" ? (
												<DropdownMenuItem
													onSelect={() =>
														pauseResume.mutate({
															id: campaign.id,
															action: "resume",
														})
													}
												>
													Resume
												</DropdownMenuItem>
											) : null}
											{campaign.status !== "running" ? (
												<>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														variant="destructive"
														onSelect={() => setToDelete(campaign)}
													>
														Delete
													</DropdownMenuItem>
												</>
											) : null}
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</SimpleTableRow>
						);
					})}
				</SimpleTable>
			)}

			{total > OUTREACH.pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(total / OUTREACH.pageSize)}
					pageSize={OUTREACH.pageSize}
					total={total}
					onPageChange={setPage}
					loading={campaigns.isFetching}
				/>
			) : null}

			<ConfirmDialog
				open={toDelete !== null}
				title={`Delete “${toDelete?.name ?? ""}”?`}
				description="Emails that were not sent yet will never be sent. Sending history and stats are kept."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}
