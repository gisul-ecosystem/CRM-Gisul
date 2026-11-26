"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Link as TextLink } from "@crm/ui/components/link";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatCard } from "@crm/ui/components/stat-card";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { useQueries, useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useUnifersHealth } from "@/components/unifers/unifers-page";
import { COUNT } from "@/lib/outreach/format";
import { campaignsApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import {
	UNIFERS_ACCOUNT_STATUS,
	UNIFERS_CAMPAIGN_STATUS,
} from "@/lib/unifers/labels";
import {
	campaignTotals,
	percentOf,
	type UnifersTotals,
} from "@/lib/unifers/overview";
import type { CampaignAnalytics } from "@/lib/unifers/schemas";
import { unifersRouteId } from "@/lib/unifers/sender";
import { UNIFERS } from "@/lib/unifers/unifers-config";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const PERCENT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

const KPIS: {
	label: string;
	value: (totals: UnifersTotals) => number;
	note: (totals: UnifersTotals) => string;
}[] = [
	{
		label: "Campaigns",
		value: (t) => t.campaigns,
		note: (t) => `${COUNT.format(t.running)} running`,
	},
	{ label: "Leads", value: (t) => t.leads, note: () => "In these campaigns" },
	{
		label: "Sent",
		value: (t) => t.sent,
		note: (t) => `${PERCENT.format(percentOf(t.delivered, t.sent))}% delivered`,
	},
	{
		label: "Opened",
		value: (t) => t.opened,
		note: (t) =>
			`${PERCENT.format(percentOf(t.opened, t.delivered))}% of delivered`,
	},
	{
		label: "Clicked",
		value: (t) => t.clicked,
		note: (t) =>
			`${PERCENT.format(percentOf(t.clicked, t.delivered))}% of delivered`,
	},
	{
		label: "Replied",
		value: (t) => t.replied,
		note: (t) =>
			`${PERCENT.format(percentOf(t.replied, t.delivered))}% of delivered`,
	},
	{
		label: "Bounced",
		value: (t) => t.bounced,
		note: (t) => `${PERCENT.format(percentOf(t.bounced, t.sent))}% of sent`,
	},
];

export function UnifersOverview() {
	const campaigns = useQuery({
		queryKey: unifersKeys.overviewCampaigns,
		queryFn: () => campaignsApi.list(0, UNIFERS.overview.maxCampaigns),
		refetchInterval: UNIFERS.refresh.listMs,
	});

	const started = (campaigns.data?.campaigns ?? []).filter(
		(campaign) => campaign.status !== "draft",
	);

	const analytics = useQueries({
		queries: started.map((campaign) => ({
			queryKey: unifersKeys.analytics(campaign.id),
			queryFn: () => campaignsApi.analytics(campaign.id),
			refetchInterval: UNIFERS.refresh.listMs,
		})),
	});

	if (campaigns.isPending) return <Skeleton className="h-48 w-full" />;
	if (campaigns.isError) {
		return (
			<p className="text-destructive text-xs">{campaigns.error.message}</p>
		);
	}

	const loaded = analytics.flatMap((result) =>
		result.data ? [result.data] : [],
	);
	const loading = analytics.some((result) => result.isPending);
	const failed = analytics.filter((result) => result.isError).length;
	const totals = campaignTotals(loaded);
	const byId = new Map(loaded.map((data) => [data.campaign.id, data]));
	const shown = campaigns.data.campaigns.length;
	const total = campaigns.data.total;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				{total > shown ? (
					<p className="text-muted-foreground text-xs">
						Totals cover the newest {COUNT.format(shown)} of{" "}
						{COUNT.format(total)} Unifers campaigns.
					</p>
				) : null}
				{failed > 0 ? (
					<p className="text-destructive text-xs">
						Unifers did not return the stats of {COUNT.format(failed)}{" "}
						campaigns. The totals leave them out.
					</p>
				) : null}
			</div>

			<Card>
				<div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 xl:grid-cols-7 xl:divide-y-0">
					{KPIS.map((kpi) => (
						<StatCard
							key={kpi.label}
							label={kpi.label}
							value={loading ? "…" : COUNT.format(kpi.value(totals))}
							description={loading ? undefined : kpi.note(totals)}
						/>
					))}
				</div>
			</Card>

			<CampaignStats
				campaigns={campaigns.data.campaigns}
				byId={byId}
				loading={loading}
			/>
			<Mailboxes />
		</div>
	);
}

function CampaignStats({
	campaigns,
	byId,
	loading,
}: {
	campaigns: CampaignAnalytics["campaign"][];
	byId: ReadonlyMap<number, CampaignAnalytics>;
	loading: boolean;
}) {
	const href = useWorkspaceUrl();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Campaigns</CardTitle>
				<CardDescription>What each Unifers campaign has sent.</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<NextLink href={href("/outreach/campaigns?sender=unifers")}>
							All campaigns
						</NextLink>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{campaigns.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No Unifers campaign yet.
					</p>
				) : (
					<SimpleTable
						columns={[
							{ id: "name", header: "Campaign" },
							{ id: "status", header: "Status" },
							{ id: "leads", header: "Leads", align: "right" },
							{ id: "sent", header: "Sent", align: "right" },
							{ id: "opened", header: "Opened", align: "right" },
							{ id: "replied", header: "Replied", align: "right" },
							{ id: "bounced", header: "Bounced", align: "right" },
						]}
					>
						{campaigns.map((campaign) => {
							const stats = byId.get(campaign.id);
							const status = UNIFERS_CAMPAIGN_STATUS[campaign.status];
							const cell = (value: number | undefined) =>
								value === undefined
									? campaign.status === "draft" || !loading
										? "—"
										: "…"
									: COUNT.format(value);
							return (
								<SimpleTableRow key={campaign.id}>
									<TableCell className="max-w-72 px-3">
										<span className="flex min-w-0 items-center gap-2">
											<TextLink asChild variant="quiet">
												<NextLink
													href={href(
														`/outreach/campaigns/${unifersRouteId(campaign.id)}`,
													)}
													className="truncate font-medium"
												>
													{campaign.name}
												</NextLink>
											</TextLink>
										</span>
									</TableCell>
									<TableCell className="px-3">
										<StatusIndicator
											tone={status.tone}
											label={status.label}
											size="sm"
										/>
									</TableCell>
									<TableCell className="px-3 text-right tabular-nums">
										{COUNT.format(campaign.leadCount)}
									</TableCell>
									<TableCell className="px-3 text-right tabular-nums">
										{cell(stats?.email.sent)}
									</TableCell>
									<TableCell className="px-3 text-right tabular-nums">
										{cell(stats?.email.opened)}
									</TableCell>
									<TableCell className="px-3 text-right tabular-nums">
										{cell(stats?.email.replied)}
									</TableCell>
									<TableCell className="px-3 text-right tabular-nums">
										{cell(stats?.email.bounced)}
									</TableCell>
								</SimpleTableRow>
							);
						})}
					</SimpleTable>
				)}
			</CardContent>
		</Card>
	);
}

function Mailboxes() {
	const accounts = useUnifersHealth();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Mailboxes</CardTitle>
				<CardDescription>
					The mailboxes Unifers sends from. Connect one in the campaign wizard.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!accounts.data ? (
					<Skeleton className="h-24 w-full" />
				) : accounts.data.accounts.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No Unifers mailbox yet.
					</p>
				) : (
					<SimpleTable
						columns={[
							{ id: "email", header: "Mailbox" },
							{ id: "name", header: "From name" },
							{ id: "status", header: "Status" },
						]}
					>
						{accounts.data.accounts.map((account) => {
							const status = UNIFERS_ACCOUNT_STATUS[account.status];
							return (
								<SimpleTableRow key={account.email}>
									<TableCell className="px-3 font-medium">
										<span className="flex items-center gap-2">
											{account.email}
											{account.isDefault ? (
												<Badge variant="outline">Default</Badge>
											) : null}
										</span>
										{account.lastError ? (
											<p className="text-destructive text-xs">
												{account.lastError}
											</p>
										) : null}
									</TableCell>
									<TableCell className="px-3 text-muted-foreground text-xs">
										{account.fromName || "—"}
									</TableCell>
									<TableCell className="px-3">
										<StatusIndicator
											tone={status.tone}
											label={status.label}
											size="sm"
										/>
									</TableCell>
								</SimpleTableRow>
							);
						})}
					</SimpleTable>
				)}
			</CardContent>
		</Card>
	);
}
