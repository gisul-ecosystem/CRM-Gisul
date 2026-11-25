"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Edit from "@carbon/icons-react/es/Edit";
import Pause from "@carbon/icons-react/es/Pause";
import Play from "@carbon/icons-react/es/Play";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Card } from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { CampaignTestSendDialog } from "@/components/outreach/campaign-test-send-dialog";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { Meter } from "@/components/outreach/meter";
import { OutreachPage } from "@/components/outreach/outreach-page";
import { ReadinessPanel } from "@/components/outreach/readiness-panel";
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
import {
	CAMPAIGN_STATUS,
	MESSAGE_STATUS,
	windowSummary,
} from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { Campaign } from "@/lib/outreach/schemas/campaign";
import {
	MESSAGE_STATUSES,
	type MessageStatus,
} from "@/lib/outreach/schemas/enums";
import { useDebounced } from "@/lib/outreach/use-debounced";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type StatusFilter = MessageStatus | typeof ALL;

const MESSAGE_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: ALL, label: "All messages" },
	...MESSAGE_STATUSES.map((status) => ({
		value: status,
		label: MESSAGE_STATUS[status].label,
	})),
];

export function CampaignDetail({
	id,
	viewerEmail,
}: {
	id: string;
	viewerEmail: string;
}) {
	const href = useWorkspaceUrl();
	const campaign = useQuery({
		queryKey: outreachKeys.campaign(id),
		queryFn: () => campaignApi.get(id),
		refetchInterval: (query) =>
			query.state.data?.status === "running"
				? OUTREACH.refresh.campaignMs
				: false,
	});

	return (
		<OutreachPage
			title={campaign.data?.name ?? "Campaign"}
			description={
				<NextLink
					href={href("/outreach/campaigns")}
					className="inline-flex items-center gap-1 hover:text-foreground"
				>
					<Icon icon={ArrowLeft} />
					Campaigns
				</NextLink>
			}
		>
			{campaign.isPending ? (
				<div className="flex flex-col gap-4">
					<Skeleton className="h-24 w-full rounded-lg" />
					<Skeleton className="h-64 w-full rounded-lg" />
				</div>
			) : campaign.isError ? (
				<Alert variant="destructive">
					<Icon icon={Warning} />
					<AlertTitle>This campaign could not be loaded.</AlertTitle>
					<AlertDescription>{campaign.error.message}</AlertDescription>
				</Alert>
			) : (
				<CampaignBody campaign={campaign.data} viewerEmail={viewerEmail} />
			)}
		</OutreachPage>
	);
}

function CampaignBody({
	campaign,
	viewerEmail,
}: {
	campaign: Campaign;
	viewerEmail: string;
}) {
	const href = useWorkspaceUrl();
	const router = useRouter();
	const cache = useOutreachCache();
	const [deleting, setDeleting] = useState(false);
	const [testOpen, setTestOpen] = useState(false);

	const live = campaign.status === "running";
	const startable = isEditable(campaign);

	const readiness = useQuery({
		queryKey: [...outreachKeys.campaign(campaign.id), "readiness"],
		queryFn: () => campaignApi.readiness(campaign.id),
		enabled: startable,
	});
	const stats = useQuery({
		queryKey: [...outreachKeys.campaign(campaign.id), "stats"],
		queryFn: () => campaignApi.stats(campaign.id),
		refetchInterval: live ? OUTREACH.refresh.campaignMs : false,
	});

	const readinessItems = [
		...(readiness.data?.saved ?? []),
		...(readiness.data?.setup ?? []),
	];
	const mustFix = readinessItems.filter(
		(item) => item.level === "error",
	).length;
	const versionNames = campaign.templates.map((template) => template.name);

	const lifecycle = useMutation({
		mutationFn: (action: "start" | "pause" | "resume") =>
			action === "start"
				? campaignApi.start(campaign.id).then((result) => result.campaign)
				: action === "pause"
					? campaignApi.pause(campaign.id)
					: campaignApi.resume(campaign.id),
		onSuccess: async (updated) => {
			await cache.campaigns(campaign.id);
			toast.success(
				updated.status === "paused"
					? "Campaign paused."
					: updated.status === "running"
						? "Campaign is running."
						: `Campaign is ${CAMPAIGN_STATUS[updated.status].label.toLowerCase()}.`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: () => campaignApi.remove(campaign.id),
		onSuccess: async () => {
			await cache.campaigns();
			toast.success("Campaign deleted.");
			router.push(href("/outreach/campaigns"));
		},
		onError: (error) => toast.error(error.message),
	});

	const { done, target } = campaignProgress(campaign);
	const queued =
		campaign.counts.pending +
		campaign.counts.scheduled +
		campaign.counts.sending;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1 text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<OutreachStatus
							status={CAMPAIGN_STATUS[campaign.status]}
							pulse={live}
						/>
					</div>
					<p>
						List: {campaign.listName ?? "—"} · {campaign.inboxIds.length} inbox
						{campaign.inboxIds.length === 1 ? "" : "es"} ·{" "}
						{windowSummary(campaign.sendWindow)}
						{stats.data ? ` (${stats.data.timezone})` : ""}
					</p>
					{campaign.followUpOf ? (
						<p>
							Follow-up: sent {campaign.followUpAfterDays} days after the first
							email, only to people who did not reply, in the same thread.
						</p>
					) : null}
					{campaign.templates.length > 1 ? (
						<p>
							Versions:{" "}
							{campaign.templates
								.map((template) =>
									template.matchValues.length
										? `${template.name} (${template.matchValues.join(", ")})`
										: template.name,
								)
								.join(" · ")}
							{campaign.variantColumn
								? ` — chosen by ${campaign.variantColumn}; others take turns`
								: " — in turn"}
						</p>
					) : null}
				</div>

				<div className="flex flex-wrap gap-2">
					{startable ? (
						<Button asChild variant="outline">
							<NextLink href={href(`/outreach/campaigns/${campaign.id}/edit`)}>
								<Icon icon={Edit} data-icon="inline-start" />
								{campaign.status === "draft" ? "Continue setup" : "Edit"}
							</NextLink>
						</Button>
					) : null}
					{startable ? (
						<Button variant="outline" onClick={() => setTestOpen(true)}>
							Send test to myself
						</Button>
					) : null}
					{campaign.status === "draft" ? (
						<Button
							disabled={
								lifecycle.isPending || mustFix > 0 || readiness.isPending
							}
							title={mustFix > 0 ? "Fix the red items first" : undefined}
							onClick={() => lifecycle.mutate("start")}
						>
							<Icon icon={Play} data-icon="inline-start" />
							Start
						</Button>
					) : null}
					{campaign.status === "running" ? (
						<Button
							variant="outline"
							disabled={lifecycle.isPending}
							onClick={() => lifecycle.mutate("pause")}
						>
							<Icon icon={Pause} data-icon="inline-start" />
							Pause
						</Button>
					) : null}
					{campaign.status === "paused" ? (
						<Button
							disabled={
								lifecycle.isPending || mustFix > 0 || readiness.isPending
							}
							title={mustFix > 0 ? "Fix the red items first" : undefined}
							onClick={() => lifecycle.mutate("resume")}
						>
							<Icon icon={Play} data-icon="inline-start" />
							Resume
						</Button>
					) : null}
					{campaign.status !== "running" ? (
						<Button variant="destructive" onClick={() => setDeleting(true)}>
							<Icon icon={TrashCan} data-icon="inline-start" />
							Delete
						</Button>
					) : null}
				</div>
			</div>

			{campaign.pauseReason ? (
				<Alert variant="destructive">
					<Icon icon={Warning} />
					<AlertTitle>The engine paused this campaign.</AlertTitle>
					<AlertDescription>{campaign.pauseReason}</AlertDescription>
				</Alert>
			) : null}

			{startable ? (
				<ReadinessPanel
					items={readinessItems}
					versionNames={versionNames}
					loading={readiness.isPending}
					title={
						campaign.status === "draft"
							? "Outlook readiness (before Start)"
							: "Outlook readiness (before Resume)"
					}
					onSendTest={() => setTestOpen(true)}
					onEditEmail={() =>
						router.push(href(`/outreach/campaigns/${campaign.id}/edit`))
					}
				/>
			) : null}

			{campaign.status === "draft" ? (
				<p className="rounded-lg border border-dashed p-6 text-muted-foreground text-xs">
					This campaign has not started. Finish the setup, then press Start.
				</p>
			) : (
				<>
					<Card>
						<div className="grid grid-cols-2 divide-x divide-y md:grid-cols-5 md:divide-y-0">
							<StatCard
								label="Sent"
								value={COUNT.format(campaign.counts.sent)}
							/>
							<StatCard label="In queue" value={COUNT.format(queued)} />
							<StatCard
								label="Failed"
								value={COUNT.format(campaign.counts.failed)}
							/>
							<StatCard
								label="Skipped"
								value={COUNT.format(campaign.counts.skipped)}
							/>
							<StatCard
								label={
									campaign.status === "completed"
										? "Finished"
										: "Estimated finish"
								}
								value={
									campaign.status === "completed" && campaign.completedAt ? (
										<LocalDateTime
											date={campaign.completedAt}
											options={DATE_TIME}
										/>
									) : stats.data?.eta ? (
										<LocalDateTime date={stats.data.eta} options={DATE_TIME} />
									) : (
										"—"
									)
								}
								description={
									stats.data &&
									campaign.status !== "completed" &&
									stats.data.dailyCapacity === 0
										? "No active inbox can send."
										: undefined
								}
							/>
						</div>
					</Card>
					<div className="flex flex-col gap-1">
						<Meter value={done} max={target} label="Campaign progress" />
						<span className="text-muted-foreground text-xs tabular-nums">
							{COUNT.format(done)} of {COUNT.format(target)} sent
							{campaign.startedAt ? (
								<>
									{" · started "}
									<LocalDateTime
										date={campaign.startedAt}
										options={DATE_TIME}
									/>
								</>
							) : null}
						</span>
					</div>
					<MessagesTable campaignId={campaign.id} live={live} />
				</>
			)}

			<CampaignTestSendDialog
				campaignId={campaign.id}
				inboxes={readiness.data?.inboxes ?? []}
				versionNames={versionNames}
				defaultTo={viewerEmail}
				open={testOpen}
				onOpenChange={setTestOpen}
			/>

			<ConfirmDialog
				open={deleting}
				title={`Delete “${campaign.name}”?`}
				description="Emails that were not sent yet will never be sent. Sending history and stats are kept."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => remove.mutate()}
				onClose={() => setDeleting(false)}
			/>
		</div>
	);
}

function MessagesTable({
	campaignId,
	live,
}: {
	campaignId: string;
	live: boolean;
}) {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>(ALL);
	const query = useDebounced(search.trim());

	const messages = useQuery({
		queryKey: [
			...outreachKeys.campaign(campaignId),
			"messages",
			{ page, query, status },
		],
		queryFn: () =>
			campaignApi.messages(campaignId, {
				page,
				limit: OUTREACH.pageSize,
				search: query || undefined,
				status: status === ALL ? undefined : status,
			}),
		placeholderData: (previous) => previous,
		refetchInterval: live ? OUTREACH.refresh.campaignMs : false,
	});

	const total = messages.data?.total ?? 0;

	return (
		<section className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-medium text-base">Messages</h2>
				<OutreachToolbar>
					<SearchBox
						value={search}
						onChange={(value) => {
							setSearch(value);
							setPage(1);
						}}
						placeholder="Search by email"
					/>
					<FilterSelect
						value={status}
						onChange={(value) => {
							setStatus(value);
							setPage(1);
						}}
						options={MESSAGE_OPTIONS}
						label="Filter by message status"
					/>
				</OutreachToolbar>
			</div>

			{messages.isError ? (
				<p className="text-destructive text-xs">{messages.error.message}</p>
			) : (
				<SimpleTable
					columns={[
						{ id: "to", header: "To" },
						{ id: "status", header: "Status" },
						{ id: "inbox", header: "Inbox" },
						{ id: "version", header: "Version" },
						{ id: "scheduled", header: "Scheduled" },
						{ id: "sent", header: "Sent" },
					]}
				>
					{messages.isPending ? (
						<SimpleTableRow>
							<TableCell colSpan={6} className="px-3">
								<Skeleton className="h-5 w-full" />
							</TableCell>
						</SimpleTableRow>
					) : messages.data.data.length === 0 ? (
						<SimpleTableRow>
							<TableCell
								colSpan={6}
								className="px-3 py-8 text-center text-muted-foreground"
							>
								No messages match.
							</TableCell>
						</SimpleTableRow>
					) : (
						messages.data.data.map((message) => (
							<SimpleTableRow key={message.id}>
								<TableCell className="px-3 font-medium">
									{message.toEmail}
								</TableCell>
								<TableCell className="px-3">
									<div className="flex flex-wrap items-center gap-2">
										{message.error ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="cursor-help">
														<OutreachStatus
															status={MESSAGE_STATUS[message.status]}
														/>
													</span>
												</TooltipTrigger>
												<TooltipContent>
													{message.error.code}: {message.error.message}
												</TooltipContent>
											</Tooltip>
										) : (
											<OutreachStatus status={MESSAGE_STATUS[message.status]} />
										)}
										{message.bounce ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="cursor-help font-medium text-destructive text-xs">
														Bounced {message.bounce.code}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													{message.bounce.message}
												</TooltipContent>
											</Tooltip>
										) : null}
										{message.repliedAt ? (
											<span className="text-muted-foreground text-xs">
												Replied
											</span>
										) : null}
									</div>
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{message.inboxEmail ?? "—"}
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{message.templateName ?? "—"}
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{message.scheduledAt ? (
										<LocalDateTime
											date={message.scheduledAt}
											options={DATE_TIME}
										/>
									) : (
										"—"
									)}
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{message.sentAt ? (
										<LocalDateTime date={message.sentAt} options={DATE_TIME} />
									) : (
										"—"
									)}
								</TableCell>
							</SimpleTableRow>
						))
					)}
				</SimpleTable>
			)}

			{total > OUTREACH.pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(total / OUTREACH.pageSize)}
					pageSize={OUTREACH.pageSize}
					total={total}
					onPageChange={setPage}
					loading={messages.isFetching}
				/>
			) : null}
		</section>
	);
}
