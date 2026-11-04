"use client";

import Warning from "@carbon/icons-react/es/Warning";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@crm/ui/components/alert";
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
import type { ChartConfig } from "@crm/ui/components/chart";
import { BarTrend } from "@crm/ui/components/dashboard-chart";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { mailApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { TrackedEmail } from "@/lib/outreach/schemas/mail";
import { useDebounced } from "@/lib/outreach/use-debounced";

type Source = "manual" | "engine" | "all";
type Period = "day" | "week" | "month";

const SOURCE_OPTIONS: { value: Source; label: string }[] = [
	{ value: "manual", label: "Sent by hand (Outlook)" },
	{ value: "engine", label: "Sent by campaigns" },
	{ value: "all", label: "All sent emails" },
];

const PERIODS = {
	day: { label: "Day", count: 14 },
	week: { label: "Week", count: 12 },
	month: { label: "Month", count: 12 },
} as const satisfies Record<Period, { label: string; count: number }>;

const CHART: ChartConfig = {
	emails: { label: "Emails", color: "var(--color-primary)" },
	people: { label: "People", color: "var(--color-muted-foreground)" },
};

export function SentEmailsTab() {
	const [source, setSource] = useState<Source>("manual");
	const [inboxId, setInboxId] = useState<string>(ALL);
	const [period, setPeriod] = useState<Period>("day");
	const [bucket, setBucket] = useState<string>(ALL);
	const [search, setSearch] = useState("");
	const [wrongLinksOnly, setWrongLinksOnly] = useState(false);
	const [page, setPage] = useState(1);
	const query = useDebounced(search.trim());

	const filters = { source, inboxId: inboxId === ALL ? undefined : inboxId };

	const stats = useQuery({
		queryKey: [...outreachKeys.sent, "stats", { ...filters, period }],
		queryFn: () =>
			mailApi.sentStats({ ...filters, period, count: PERIODS[period].count }),
		refetchInterval: OUTREACH.refresh.listMs,
	});

	const selected = stats.data?.buckets.find((entry) => entry.from === bucket);

	const emails = useQuery({
		queryKey: [
			...outreachKeys.sent,
			"list",
			{ ...filters, page, query, wrongLinksOnly, bucket },
		],
		queryFn: () =>
			mailApi.sent({
				...filters,
				page,
				limit: OUTREACH.pageSize,
				search: query || undefined,
				wrongLinksOnly: wrongLinksOnly || undefined,
				from: selected?.from,
				to: selected?.to,
			}),
		placeholderData: (previous) => previous,
		refetchInterval: OUTREACH.refresh.listMs,
	});

	const reset = () => setPage(1);
	const inboxOptions = [
		{ value: ALL, label: "All inboxes" },
		...(stats.data?.inboxes ?? []).map((inbox) => ({
			value: inbox.id,
			label: inbox.email,
		})),
	];
	const bucketOptions = [
		{ value: ALL, label: `Every ${period}` },
		...(stats.data?.buckets ?? []).map((entry) => ({
			value: entry.from,
			label: `${entry.label} (${COUNT.format(entry.emails)})`,
		})),
	];
	const rows = emails.data?.data ?? [];
	const total = emails.data?.total ?? 0;

	return (
		<div className="flex flex-col gap-4">
			{stats.data && stats.data.wrongLinkEmails > 0 ? (
				<Alert variant="destructive">
					<Icon icon={Warning} />
					<AlertTitle>
						{COUNT.format(stats.data.wrongLinkEmails)} email
						{stats.data.wrongLinkEmails === 1 ? "" : "s"} contain someone else's
						tracking link.
					</AlertTitle>
					<AlertDescription>
						Their clicks count for the wrong person.
					</AlertDescription>
					<AlertAction>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setWrongLinksOnly((value) => !value);
								reset();
							}}
						>
							{wrongLinksOnly ? "Show all emails" : "Show them"}
						</Button>
					</AlertAction>
				</Alert>
			) : null}

			<OutreachToolbar>
				<FilterSelect
					value={source}
					onChange={(value) => {
						setSource(value);
						reset();
					}}
					options={SOURCE_OPTIONS}
					label="Who sent them"
				/>
				<FilterSelect
					value={inboxId}
					onChange={(value) => {
						setInboxId(value);
						reset();
					}}
					options={inboxOptions}
					label="Inbox"
				/>
			</OutreachToolbar>

			<Card>
				<div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
					<CountStat label="Today" count={stats.data?.today} />
					<CountStat label="This week" count={stats.data?.thisWeek} />
					<CountStat label="This month" count={stats.data?.thisMonth} />
				</div>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Emails sent per {period}</CardTitle>
					<CardDescription>
						{stats.data ? `Times are in ${stats.data.timezone}.` : "Loading…"}
					</CardDescription>
					<CardAction>
						<ToggleGroup
							type="single"
							value={period}
							onValueChange={(next) => {
								if (next === "day" || next === "week" || next === "month") {
									setPeriod(next);
									setBucket(ALL);
									reset();
								}
							}}
							size="sm"
							spacing={0}
						>
							{(Object.keys(PERIODS) as Period[]).map((value) => (
								<ToggleGroupItem key={value} value={value}>
									{PERIODS[value].label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</CardAction>
				</CardHeader>
				<CardContent>
					{stats.data ? (
						<BarTrend
							data={stats.data.buckets.map((entry) => ({
								label: entry.label,
								emails: entry.emails,
								people: entry.people,
							}))}
							config={CHART}
							xKey="label"
							showLegend
						/>
					) : (
						<Skeleton className="h-44 w-full" />
					)}
				</CardContent>
			</Card>

			<OutreachToolbar>
				<SearchBox
					value={search}
					onChange={(value) => {
						setSearch(value);
						reset();
					}}
					placeholder="Search recipient or subject"
				/>
				<FilterSelect
					value={bucket}
					onChange={(value) => {
						setBucket(value);
						reset();
					}}
					options={bucketOptions}
					label="Period"
				/>
			</OutreachToolbar>

			{emails.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : emails.isError ? (
				<p className="text-destructive text-xs">{emails.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{query || bucket !== ALL
								? "No match"
								: "No sent emails found yet"}
						</EmptyTitle>
						<EmptyDescription>
							Outreach reads each inbox's Sent Items every five minutes.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "sent", header: "Sent" },
						{ id: "to", header: "To" },
						{ id: "subject", header: "Subject" },
						{ id: "inbox", header: "From inbox" },
						{ id: "result", header: "Result" },
						...(source === "all" ? [{ id: "by", header: "Sent by" }] : []),
					]}
				>
					{rows.map((email) => (
						<SimpleTableRow key={email.id}>
							<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
								<LocalDateTime date={email.sentAt} options={DATE_TIME} />
							</TableCell>
							<TableCell className="max-w-56 px-3">
								<p className="truncate">
									{email.contacts[0]?.name || email.to[0] || "—"}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{[...email.to, ...email.cc].slice(0, 3).join(", ")}
									{email.to.length + email.cc.length > 3 ? "…" : ""}
								</p>
							</TableCell>
							<TableCell className="max-w-72 truncate px-3">
								{email.subject || "(no subject)"}
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								{email.inboxEmail}
							</TableCell>
							<TableCell className="px-3">
								<ResultBadges email={email} />
							</TableCell>
							{source === "all" ? (
								<TableCell className="px-3 text-muted-foreground text-xs">
									{email.source === "manual" ? "By hand" : "Campaign"}
								</TableCell>
							) : null}
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			{total > OUTREACH.pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(total / OUTREACH.pageSize)}
					pageSize={OUTREACH.pageSize}
					total={total}
					onPageChange={setPage}
					loading={emails.isFetching}
				/>
			) : null}
		</div>
	);
}

function CountStat({
	label,
	count,
}: {
	label: string;
	count: { emails: number; people: number } | undefined;
}) {
	return (
		<StatCard
			label={label}
			value={count ? COUNT.format(count.emails) : "—"}
			description={
				count ? `to ${COUNT.format(count.people)} people` : undefined
			}
		/>
	);
}

function ResultBadges({ email }: { email: TrackedEmail }) {
	const bots = email.clicks.total - email.clicks.real;
	return (
		<div className="flex flex-wrap gap-1">
			{email.repliedAt ? (
				<Badge
					variant="secondary"
					title={`Reply from ${email.replyFromEmail ?? "?"}`}
				>
					Replied
				</Badge>
			) : null}
			{email.clicks.real > 0 ? (
				<Badge variant="secondary">Clicked {email.clicks.real}×</Badge>
			) : bots > 0 ? (
				<Badge
					variant="outline"
					title="The link was opened, but it looks like a security scanner, not a person."
				>
					Maybe a bot
				</Badge>
			) : null}
			{email.wrongLinks.length > 0 ? (
				<Badge
					variant="destructive"
					title={email.wrongLinks
						.map((link) => `${link.ownerName || link.ownerEmail}'s link`)
						.join(", ")}
				>
					Wrong link
				</Badge>
			) : null}
			{!email.repliedAt &&
			email.clicks.total === 0 &&
			email.wrongLinks.length === 0 ? (
				<span className="text-muted-foreground text-xs">—</span>
			) : null}
		</div>
	);
}
