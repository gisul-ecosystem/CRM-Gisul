"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { UnifersPage } from "@/components/unifers/unifers-page";
import { COUNT } from "@/lib/outreach/format";
import { useTRPC } from "@/lib/trpc/client";
import { campaignsApi } from "@/lib/unifers/api";
import { unifersKeys, useUnifersCache } from "@/lib/unifers/cache";
import {
	LEAD_EVENT_LABEL,
	UNIFERS_CAMPAIGN_STATUS,
} from "@/lib/unifers/labels";
import {
	type CampaignAction,
	type CampaignAnalytics,
	LEAD_EVENTS,
	type LeadEvent,
} from "@/lib/unifers/schemas";
import { UNIFERS } from "@/lib/unifers/unifers-config";

const PERCENT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export function UnifersCampaignDetail({ id }: { id: number }) {
	const analytics = useQuery({
		queryKey: unifersKeys.analytics(id),
		queryFn: () => campaignsApi.analytics(id),
		refetchInterval: UNIFERS.refresh.activeMs,
	});
	const name = analytics.data?.campaign.name ?? "Campaign";

	return (
		<UnifersPage
			title={
				<span className="flex items-center gap-2">
					{name}
					<Badge variant="outline">Unifers</Badge>
				</span>
			}
			description="Sent with Unifers. Numbers refresh every few seconds."
		>
			{analytics.isPending ? (
				<Skeleton className="h-64 w-full rounded-lg" />
			) : analytics.isError ? (
				<p className="text-destructive text-xs">{analytics.error.message}</p>
			) : (
				<Detail id={id} data={analytics.data} />
			)}
		</UnifersPage>
	);
}

function Detail({ id, data }: { id: number; data: CampaignAnalytics }) {
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const isAdmin = workspace.data?.canChangeRoles ?? false;
	const cache = useUnifersCache();
	const scheduleId = useId();
	const [scheduleAt, setScheduleAt] = useState("");
	const [cancelling, setCancelling] = useState(false);
	const { campaign, leads, email } = data;
	const status = UNIFERS_CAMPAIGN_STATUS[campaign.status];

	const change = useMutation({
		mutationFn: ({
			action,
			startAt,
		}: {
			action: CampaignAction;
			startAt?: string;
		}) => campaignsApi.setStatus(id, action, startAt),
		onSuccess: async (result) => {
			await cache.everything();
			setCancelling(false);
			toast.success(
				`Now ${UNIFERS_CAMPAIGN_STATUS[result.campaign.status].label.toLowerCase()}.`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const canStart = ["draft", "scheduled", "paused"].includes(campaign.status);
	const canPause = ["active", "scheduled"].includes(campaign.status);
	const canCancel = ["active", "paused"].includes(campaign.status);
	const scheduleValid =
		scheduleAt !== "" && new Date(scheduleAt).getTime() > Date.now();

	const tiles = [
		["Leads", leads.total, `${COUNT.format(leads.enrolled)} in the sequence`],
		[
			"Sent",
			email.sent,
			`${PERCENT.format(email.rates.deliveredPctOfSent)}% delivered`,
		],
		[
			"Opened",
			email.opened,
			`${PERCENT.format(email.rates.openedPctOfDelivered)}% of delivered`,
		],
		[
			"Clicked",
			email.clicked,
			`${PERCENT.format(email.rates.clickedPctOfDelivered)}% of delivered`,
		],
		[
			"Replied",
			email.replied,
			`${PERCENT.format(email.rates.repliedPctOfDelivered)}% of delivered`,
		],
		[
			"Bounced",
			email.bounced,
			`${PERCENT.format(email.rates.bouncedPctOfSent)}% of sent`,
		],
	] as const;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>
						<StatusIndicator tone={status.tone} label={status.label} />
					</CardTitle>
					<CardDescription>
						{campaign.senders.length
							? `From ${campaign.senders.join(", ")}.`
							: "From your default Unifers mailbox."}{" "}
						{campaign.sendWindow?.start && campaign.sendWindow.end
							? `Sends ${campaign.sendWindow.start}–${campaign.sendWindow.end} ${campaign.sendWindow.timeZone ?? "UTC"}.`
							: "Sends at any time."}
						{campaign.scheduledStartAt && campaign.status === "scheduled"
							? ` Starts ${new Date(campaign.scheduledStartAt).toLocaleString()}.`
							: ""}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{campaign.lastError ? (
						<p className="text-destructive text-sm">{campaign.lastError}</p>
					) : null}
					{isAdmin ? (
						<div className="flex flex-wrap items-end gap-3">
							<Button
								size="sm"
								disabled={!canStart || change.isPending}
								onClick={() => change.mutate({ action: "start" })}
							>
								{campaign.status === "paused" ? "Resume" : "Start now"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!canPause || change.isPending}
								onClick={() => change.mutate({ action: "pause" })}
							>
								Pause
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!canCancel || change.isPending}
								onClick={() => setCancelling(true)}
							>
								Cancel campaign
							</Button>
							{campaign.status === "draft" ||
							campaign.status === "scheduled" ? (
								<>
									<Field className="w-auto">
										<FieldLabel htmlFor={scheduleId}>Schedule for</FieldLabel>
										<Input
											id={scheduleId}
											type="datetime-local"
											value={scheduleAt}
											onChange={(event) => setScheduleAt(event.target.value)}
										/>
									</Field>
									<Button
										variant="outline"
										size="sm"
										disabled={!scheduleValid || change.isPending}
										onClick={() =>
											change.mutate({
												action: "start",
												startAt: new Date(scheduleAt).toISOString(),
											})
										}
									>
										Schedule
									</Button>
								</>
							) : null}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							Only an owner or an admin can start, schedule, pause or cancel
							this campaign.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
				{tiles.map(([label, value, note]) => (
					<Card key={label}>
						<CardHeader>
							<CardDescription>{label}</CardDescription>
							<CardTitle>{COUNT.format(value)}</CardTitle>
							<CardDescription>{note}</CardDescription>
						</CardHeader>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Steps</CardTitle>
					<CardDescription>
						Where leads are in the sequence, and how each email did.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<SimpleTable
						columns={[
							{ id: "step", header: "Step" },
							{ id: "waiting", header: "Waiting here", align: "right" },
							{ id: "sent", header: "Sent", align: "right" },
							{ id: "opened", header: "Opened", align: "right" },
							{ id: "replied", header: "Replied", align: "right" },
							{ id: "bounced", header: "Bounced", align: "right" },
						]}
					>
						{data.steps.map((step) => (
							<SimpleTableRow key={step.id}>
								<TableCell className="max-w-72 truncate px-3">
									{step.type === "wait"
										? `Wait ${step.wait ?? ""}`
										: (step.subject ?? step.id)}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{COUNT.format(step.waiting)}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{step.email ? COUNT.format(step.email.sent) : "—"}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{step.email ? COUNT.format(step.email.opened) : "—"}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{step.email ? COUNT.format(step.email.replied) : "—"}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{step.email ? COUNT.format(step.email.bounced) : "—"}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				</CardContent>
			</Card>

			<LeadsByEvent id={id} />

			<ConfirmDialog
				open={cancelling}
				title={`Cancel “${campaign.name}”?`}
				description="It stops for good. Leads still in the sequence leave it. This cannot be undone."
				action="Cancel campaign"
				pending={change.isPending}
				onConfirm={() => change.mutate({ action: "cancel" })}
				onClose={() => setCancelling(false)}
			/>
		</div>
	);
}

function LeadsByEvent({ id }: { id: number }) {
	const [event, setEvent] = useState<LeadEvent>("replied");
	const [page, setPage] = useState(1);
	const { leadsPageSize } = UNIFERS;
	const offset = (page - 1) * leadsPageSize;

	const leads = useQuery({
		queryKey: unifersKeys.leads(id, event, offset),
		queryFn: () => campaignsApi.leads(id, event, offset),
		placeholderData: (previous) => previous,
		refetchInterval: UNIFERS.refresh.listMs,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Leads by what they did</CardTitle>
				<CardDescription>
					Pick an event to see who it happened to, and at which email.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Tabs
					value={event}
					onValueChange={(next) => {
						const match = LEAD_EVENTS.find((item) => item === next);
						if (match) {
							setEvent(match);
							setPage(1);
						}
					}}
				>
					<TabsList>
						{LEAD_EVENTS.map((item) => (
							<TabsTrigger key={item} value={item}>
								{LEAD_EVENT_LABEL[item]}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{leads.isPending ? (
					<Skeleton className="h-32 w-full rounded-lg" />
				) : leads.isError ? (
					<p className="text-destructive text-xs">{leads.error.message}</p>
				) : leads.data.leads.length === 0 ? (
					<p className="text-muted-foreground text-sm">Nobody yet.</p>
				) : (
					<SimpleTable
						columns={[
							{ id: "person", header: "Person" },
							{ id: "steps", header: "Emails" },
						]}
					>
						{leads.data.leads.map((lead) => (
							<SimpleTableRow key={lead.email}>
								<TableCell className="max-w-72 px-3">
									<p className="truncate">{lead.name || lead.email}</p>
									<p className="truncate text-muted-foreground text-xs">
										{lead.email}
									</p>
								</TableCell>
								<TableCell className="px-3 text-muted-foreground text-xs">
									{lead.steps.join(", ") || "—"}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
				{(leads.data?.total ?? 0) > leadsPageSize ? (
					<TablePagination
						page={page}
						totalPages={Math.ceil((leads.data?.total ?? 0) / leadsPageSize)}
						pageSize={leadsPageSize}
						total={leads.data?.total ?? 0}
						onPageChange={setPage}
						loading={leads.isFetching}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}
