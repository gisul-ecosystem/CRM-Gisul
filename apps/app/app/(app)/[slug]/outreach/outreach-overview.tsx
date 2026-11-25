"use client";

import Add from "@carbon/icons-react/es/Add";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import type { ChartConfig } from "@crm/ui/components/chart";
import { BarTrend } from "@crm/ui/components/dashboard-chart";
import { Icon } from "@crm/ui/components/icon";
import { Link as TextLink } from "@crm/ui/components/link";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { Meter } from "@/components/outreach/meter";
import { OutreachPage } from "@/components/outreach/outreach-page";
import { OutreachStatus } from "@/components/outreach/status";
import { dashboardApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import {
	CAMPAIGN_STATUS,
	INBOX_STATUS,
	SENDING_MODE_LABEL,
} from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { DashboardSummary } from "@/lib/outreach/schemas/dashboard";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const CHART: ChartConfig = {
	sent: { label: "Sent", color: "var(--color-primary)" },
	failed: { label: "Failed", color: "var(--color-destructive)" },
};

const KPIS: {
	label: string;
	value: (summary: DashboardSummary) => number;
}[] = [
	{ label: "Sent today", value: (s) => s.sentToday },
	{ label: "Sent this week", value: (s) => s.sentThisWeek },
	{ label: "Total sent", value: (s) => s.totalSent },
	{ label: "In queue", value: (s) => s.inQueue },
	{ label: "Failed today", value: (s) => s.failedToday },
	{ label: "Active inboxes", value: (s) => s.activeInboxes },
	{ label: "Real clicks this week", value: (s) => s.realClicksThisWeek },
];

export function OutreachOverview() {
	const href = useWorkspaceUrl();

	return (
		<OutreachPage
			title="Outreach"
			description="Cold-email campaigns sent from your own inboxes, one email at a time."
			actions={
				<Button asChild>
					<NextLink href={href("/outreach/campaigns/new")}>
						<Icon icon={Add} data-icon="inline-start" />
						New campaign
					</NextLink>
				</Button>
			}
		>
			<OverviewBody />
		</OutreachPage>
	);
}

function OverviewBody() {
	const summary = useQuery({
		queryKey: [...outreachKeys.dashboard, "summary"],
		queryFn: dashboardApi.summary,
		refetchInterval: OUTREACH.refresh.dashboardMs,
	});

	if (summary.isPending) return <OverviewSkeleton />;
	if (summary.isError) {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>Outreach could not load the overview.</AlertTitle>
				<AlertDescription>{summary.error.message}</AlertDescription>
			</Alert>
		);
	}

	const data = summary.data;

	return (
		<div className="flex flex-col gap-6">
			<StatusBanners summary={data} />

			<Card>
				<div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 xl:grid-cols-7 xl:divide-y-0">
					{KPIS.map((kpi) => (
						<StatCard
							key={kpi.label}
							label={kpi.label}
							value={COUNT.format(kpi.value(data))}
						/>
					))}
				</div>
			</Card>

			<div className="grid gap-6 lg:grid-cols-3">
				<NextEmailCard summary={data} />
				<SentChartCard />
			</div>

			<CampaignProgress />
			<InboxHealth />

			<div className="grid gap-6 lg:grid-cols-2">
				<ClickersCard />
				<ActivityCard />
			</div>
		</div>
	);
}

function StatusBanners({ summary }: { summary: DashboardSummary }) {
	const mode = SENDING_MODE_LABEL[summary.mode];

	return (
		<div className="flex flex-col gap-2">
			{summary.mode !== "live" ? (
				<Alert variant="warning">
					<Icon icon={Warning} />
					<AlertTitle>{mode.label}</AlertTitle>
					<AlertDescription>{mode.description}</AlertDescription>
				</Alert>
			) : null}
			{!summary.workerRunning ? (
				<Alert variant="warning">
					<Icon icon={Warning} />
					<AlertTitle>The sending worker is not running.</AlertTitle>
					<AlertDescription>
						Campaigns stay queued until the Outreach worker process starts.
					</AlertDescription>
				</Alert>
			) : null}
			{summary.alerts.map((alert) => (
				<Alert key={alert.campaignId} variant="destructive">
					<Icon icon={Warning} />
					<AlertTitle>
						Campaign “{alert.campaignName}” paused itself.
					</AlertTitle>
					<AlertDescription>
						{alert.reason} Fix the cause, then resume the campaign.
					</AlertDescription>
				</Alert>
			))}
		</div>
	);
}

function NextEmailCard({ summary }: { summary: DashboardSummary }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Next email</CardTitle>
				<CardDescription>Times are in {summary.timezone}.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2 text-xs">
				{summary.nextEmail ? (
					<>
						<p className="font-medium text-sm">{summary.nextEmail.to}</p>
						<p className="text-muted-foreground">
							From {summary.nextEmail.fromInbox}
						</p>
						<p className="text-muted-foreground">
							<LocalDateTime
								date={summary.nextEmail.scheduledAt}
								options={DATE_TIME}
							/>
						</p>
					</>
				) : (
					<p className="text-muted-foreground">
						{summary.idleReason ?? "Nothing is scheduled."}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function SentChartCard() {
	const timeline = useQuery({
		queryKey: [
			...outreachKeys.dashboard,
			"timeline",
			OUTREACH.overview.timelineDays,
		],
		queryFn: () => dashboardApi.timeline(OUTREACH.overview.timelineDays),
		refetchInterval: OUTREACH.refresh.dashboardMs,
	});

	return (
		<Card className="lg:col-span-2">
			<CardHeader>
				<CardTitle>Sent per day</CardTitle>
				<CardDescription>
					Last {OUTREACH.overview.timelineDays} days.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{timeline.data ? (
					<BarTrend
						data={timeline.data.map((day) => ({
							date: day.date,
							sent: day.sent,
							failed: day.failed,
						}))}
						config={CHART}
						xKey="date"
						stacked
						showLegend
						formatX={(value) => value.slice(5)}
					/>
				) : (
					<Skeleton className="h-44 w-full" />
				)}
			</CardContent>
		</Card>
	);
}

function CampaignProgress() {
	const href = useWorkspaceUrl();
	const campaigns = useQuery({
		queryKey: [...outreachKeys.dashboard, "campaigns"],
		queryFn: dashboardApi.campaigns,
		refetchInterval: OUTREACH.refresh.dashboardMs,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Campaigns</CardTitle>
				<CardDescription>Running and paused campaigns.</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<NextLink href={href("/outreach/campaigns")}>
							All campaigns
						</NextLink>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{!campaigns.data ? (
					<Skeleton className="h-16 w-full" />
				) : campaigns.data.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No campaign is running.
					</p>
				) : (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{campaigns.data.map((campaign) => (
							<div
								key={campaign.id}
								className="flex flex-col gap-2 rounded-lg border p-4"
							>
								<div className="flex items-center justify-between gap-2">
									<TextLink asChild variant="quiet">
										<NextLink
											href={href(`/outreach/campaigns/${campaign.id}`)}
											className="truncate font-medium text-sm"
										>
											{campaign.name}
										</NextLink>
									</TextLink>
									<OutreachStatus
										status={CAMPAIGN_STATUS[campaign.status]}
										pulse={campaign.status === "running"}
									/>
								</div>
								<Meter
									value={campaign.sent}
									max={campaign.total}
									label={`${campaign.name} progress`}
								/>
								<p className="text-muted-foreground text-xs">
									{COUNT.format(campaign.sent)} of{" "}
									{COUNT.format(campaign.total)} sent ·{" "}
									{COUNT.format(campaign.failed)} failed ·{" "}
									{COUNT.format(campaign.skipped)} skipped
								</p>
								{campaign.eta ? (
									<p className="text-muted-foreground text-xs">
										Finishes around{" "}
										<LocalDateTime date={campaign.eta} options={DATE_TIME} />
									</p>
								) : null}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function InboxHealth() {
	const href = useWorkspaceUrl();
	const inboxes = useQuery({
		queryKey: [...outreachKeys.dashboard, "inboxes"],
		queryFn: dashboardApi.inboxes,
		refetchInterval: OUTREACH.refresh.dashboardMs,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Inboxes today</CardTitle>
				<CardDescription>
					How much each sending inbox has used of its daily limit.
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<NextLink href={href("/outreach/setup")}>Sending setup</NextLink>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{!inboxes.data ? (
					<Skeleton className="h-24 w-full" />
				) : inboxes.data.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No sending inbox yet. Add one in Sending setup.
					</p>
				) : (
					<SimpleTable
						columns={[
							{ id: "email", header: "Inbox" },
							{ id: "status", header: "Status" },
							{ id: "today", header: "Sent today" },
							{ id: "last", header: "Last sent" },
							{ id: "next", header: "Next send" },
						]}
					>
						{inboxes.data.map((inbox) => (
							<SimpleTableRow key={inbox.id}>
								<TableCell className="px-3 font-medium">
									{inbox.email}
								</TableCell>
								<TableCell className="px-3">
									<OutreachStatus status={INBOX_STATUS[inbox.status]} />
									{inbox.pauseReason ? (
										<p className="text-muted-foreground text-xs">
											{inbox.pauseReason}
										</p>
									) : null}
								</TableCell>
								<TableCell className="w-48 px-3">
									<div className="flex flex-col gap-1">
										<span className="text-xs tabular-nums">
											{inbox.sentToday} / {inbox.dailyLimit}
										</span>
										<Meter
											value={inbox.sentToday}
											max={inbox.dailyLimit}
											label={`${inbox.email} daily limit used`}
										/>
									</div>
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{inbox.lastSentAt ? (
										<LocalDateTime
											date={inbox.lastSentAt}
											options={DATE_TIME}
										/>
									) : (
										"Never"
									)}
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{inbox.nextScheduledAt ? (
										<LocalDateTime
											date={inbox.nextScheduledAt}
											options={DATE_TIME}
										/>
									) : (
										"—"
									)}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</CardContent>
		</Card>
	);
}

function ClickersCard() {
	const [period, setPeriod] = useState<"week" | "all">("week");
	const clickers = useQuery({
		queryKey: [...outreachKeys.dashboard, "clickers", period],
		queryFn: () =>
			dashboardApi.clickers(period, OUTREACH.overview.clickersLimit),
		refetchInterval: OUTREACH.refresh.dashboardMs,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Clicks per person</CardTitle>
				<CardDescription>
					Real clicks and bot opens of each person's tracking links.
				</CardDescription>
				<CardAction>
					<ToggleGroup
						type="single"
						value={period}
						onValueChange={(next) =>
							next === "week" || next === "all" ? setPeriod(next) : undefined
						}
						size="sm"
						spacing={0}
					>
						<ToggleGroupItem value="week">This week</ToggleGroupItem>
						<ToggleGroupItem value="all">All time</ToggleGroupItem>
					</ToggleGroup>
				</CardAction>
			</CardHeader>
			<CardContent>
				{!clickers.data ? (
					<Skeleton className="h-24 w-full" />
				) : clickers.data.length === 0 ? (
					<p className="text-muted-foreground text-xs">No clicks yet.</p>
				) : (
					<SimpleTable
						columns={[
							{ id: "person", header: "Person" },
							{ id: "real", header: "Real", align: "right" },
							{ id: "bot", header: "Bot opens", align: "right" },
						]}
					>
						{clickers.data.map((person) => (
							<SimpleTableRow key={person.contactId}>
								<TableCell className="px-3">
									<p className="font-medium">{person.name || person.email}</p>
									<p className="text-muted-foreground text-xs">
										{person.company || person.email}
									</p>
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{person.realClicks}
								</TableCell>
								<TableCell className="px-3 text-right text-muted-foreground tabular-nums">
									{person.botOpens}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</CardContent>
		</Card>
	);
}

function ActivityCard() {
	const activity = useQuery({
		queryKey: [...outreachKeys.dashboard, "activity"],
		queryFn: dashboardApi.activity,
		refetchInterval: OUTREACH.refresh.dashboardMs,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent engine activity</CardTitle>
				<CardDescription>
					Sends, pauses and alerts from the worker.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!activity.data ? (
					<Skeleton className="h-24 w-full" />
				) : activity.data.length === 0 ? (
					<p className="text-muted-foreground text-xs">Nothing yet.</p>
				) : (
					<ul className="flex flex-col divide-y">
						{activity.data.map((entry) => (
							<li key={entry.id} className="flex flex-col gap-0.5 py-2 text-xs">
								<span>{entry.message}</span>
								<span className="text-muted-foreground">
									<LocalDateTime date={entry.createdAt} options={DATE_TIME} />
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function OverviewSkeleton() {
	return (
		<div className="flex flex-col gap-6" aria-busy="true">
			<Skeleton className="h-24 w-full rounded-lg" />
			<div className="grid gap-6 lg:grid-cols-3">
				<Skeleton className="h-56 w-full rounded-lg" />
				<Skeleton className="h-56 w-full rounded-lg lg:col-span-2" />
			</div>
			<Skeleton className="h-40 w-full rounded-lg" />
		</div>
	);
}
