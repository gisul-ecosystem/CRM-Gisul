"use client";

import { Button } from "@crm/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { FormattedText } from "@crm/ui/components/formatted-text";
import { Link as TextLink } from "@crm/ui/components/link";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { OutreachPage } from "@/components/outreach/outreach-page";
import { OutreachStatus } from "@/components/outreach/status";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { mailApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { INCOMING_KIND } from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import {
	INCOMING_KIND_FILTERS,
	type IncomingKindFilter,
} from "@/lib/outreach/schemas/enums";
import { useDebounced } from "@/lib/outreach/use-debounced";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const KIND_LABELS = {
	all: "All",
	reply: "Replies",
	bounce: "Bounces",
	auto_reply: "Auto-replies",
	other: "Other",
} as const satisfies Record<IncomingKindFilter, string>;

export function RepliesView() {
	return (
		<OutreachPage
			title="Replies"
			description="Everything that arrived in the sending inboxes: replies, bounces and auto-replies. Read-only."
		>
			<RepliesTable />
		</OutreachPage>
	);
}

function RepliesTable() {
	const [kind, setKind] = useState<IncomingKindFilter>("all");
	const [inboxId, setInboxId] = useState<string>(ALL);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [openId, setOpenId] = useState<string | null>(null);
	const query = useDebounced(search.trim());

	const replies = useQuery({
		queryKey: [...outreachKeys.replies, "list", { kind, inboxId, query, page }],
		queryFn: () =>
			mailApi.replies({
				kind,
				inboxId: inboxId === ALL ? undefined : inboxId,
				search: query || undefined,
				page,
				limit: OUTREACH.pageSize,
			}),
		placeholderData: (previous) => previous,
		refetchInterval: OUTREACH.refresh.listMs,
	});

	const counts = replies.data?.counts;
	const inboxOptions = [
		{ value: ALL, label: "All inboxes" },
		...(replies.data?.inboxes ?? []).map((inbox) => ({
			value: inbox.id,
			label: inbox.email,
		})),
	];
	const lastChecked = (replies.data?.inboxes ?? [])
		.map((inbox) => inbox.checkedAt)
		.filter((value): value is string => value !== null)
		.sort()
		.at(-1);
	const rows = replies.data?.data ?? [];
	const total = replies.data?.total ?? 0;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<ToggleGroup
					type="single"
					value={kind}
					onValueChange={(next) => {
						const match = INCOMING_KIND_FILTERS.find((value) => value === next);
						if (match) {
							setKind(match);
							setPage(1);
						}
					}}
					size="sm"
					spacing={0}
				>
					{INCOMING_KIND_FILTERS.map((value) => (
						<ToggleGroupItem key={value} value={value}>
							{KIND_LABELS[value]}
							{counts ? (
								<span className="ml-1 text-muted-foreground tabular-nums">
									{COUNT.format(counts[value])}
								</span>
							) : null}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				{lastChecked ? (
					<span className="text-muted-foreground text-xs">
						Last read <LocalDateTime date={lastChecked} options={DATE_TIME} />
					</span>
				) : null}
			</div>

			<OutreachToolbar>
				<SearchBox
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
					placeholder="Search sender or subject"
				/>
				<FilterSelect
					value={inboxId}
					onChange={(value) => {
						setInboxId(value);
						setPage(1);
					}}
					options={inboxOptions}
					label="Inbox"
				/>
			</OutreachToolbar>

			{replies.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : replies.isError ? (
				<p className="text-destructive text-xs">{replies.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{query || kind !== "all" ? "No match" : "No emails received yet"}
						</EmptyTitle>
						<EmptyDescription>
							Outreach reads each inbox every five minutes. This needs the
							Mail.Read permission on the Microsoft connection.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "received", header: "Received" },
						{ id: "from", header: "From" },
						{ id: "subject", header: "Subject" },
						{ id: "inbox", header: "Inbox" },
						{ id: "type", header: "Type" },
					]}
				>
					{rows.map((email) => (
						<SimpleTableRow
							key={email.id}
							clickable
							onClick={() => setOpenId(email.id)}
						>
							<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
								<LocalDateTime date={email.receivedAt} options={DATE_TIME} />
							</TableCell>
							<TableCell className="max-w-56 px-3">
								<p className="truncate">{email.fromName || email.fromEmail}</p>
								{email.fromName ? (
									<p className="truncate text-muted-foreground text-xs">
										{email.fromEmail}
									</p>
								) : null}
							</TableCell>
							<TableCell className="max-w-80 px-3">
								<p className="truncate font-medium">
									{email.subject || "(no subject)"}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{email.preview}
								</p>
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								{email.inboxEmail}
							</TableCell>
							<TableCell className="px-3">
								<div className="flex flex-col gap-0.5">
									<OutreachStatus status={INCOMING_KIND[email.kind]} />
									{email.campaign ? (
										<span className="max-w-40 truncate text-muted-foreground text-xs">
											{email.campaign.name}
										</span>
									) : null}
								</div>
							</TableCell>
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
					loading={replies.isFetching}
				/>
			) : null}

			<ReplySheet id={openId} onClose={() => setOpenId(null)} />
		</div>
	);
}

function ReplySheet({
	id,
	onClose,
}: {
	id: string | null;
	onClose: () => void;
}) {
	return (
		<Sheet
			open={id !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent size="lg" className="overflow-y-auto">
				{id ? <ReplyBody key={id} id={id} /> : null}
			</SheetContent>
		</Sheet>
	);
}

function ReplyBody({ id }: { id: string }) {
	const href = useWorkspaceUrl();
	const [showFull, setShowFull] = useState(false);
	const email = useQuery({
		queryKey: [...outreachKeys.replies, id],
		queryFn: () => mailApi.reply(id),
	});

	if (email.isPending) {
		return (
			<div className="flex flex-col gap-3 p-4">
				<Skeleton className="h-6 w-2/3" />
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}
	if (email.isError) {
		return (
			<p className="p-4 text-destructive text-xs">{email.error.message}</p>
		);
	}

	const data = email.data;
	const hasMore =
		data.body.trim() !== "" && data.body.trim() !== data.text.trim();

	return (
		<>
			<SheetHeader>
				<SheetTitle size="lg">{data.subject || "(no subject)"}</SheetTitle>
				<SheetDescription>
					From{" "}
					{data.fromName
						? `${data.fromName} <${data.fromEmail}>`
						: data.fromEmail}{" "}
					to {data.inboxEmail} ·{" "}
					<LocalDateTime date={data.receivedAt} options={DATE_TIME} />
				</SheetDescription>
			</SheetHeader>
			<div className="flex flex-col gap-4 px-4 pb-6">
				<div className="flex flex-wrap items-center gap-3 text-xs">
					<OutreachStatus status={INCOMING_KIND[data.kind]} />
					{data.campaign ? (
						<TextLink asChild>
							<NextLink href={href(`/outreach/campaigns/${data.campaign.id}`)}>
								Campaign: {data.campaign.name}
							</NextLink>
						</TextLink>
					) : null}
					{data.contact ? (
						<span className="text-muted-foreground">
							Contact: {data.contact.name || data.contact.email}
						</span>
					) : null}
				</div>
				<div className="rounded-lg border p-3">
					<FormattedText
						text={
							(showFull ? data.body : data.text || data.body).trim() ||
							"(empty)"
						}
					/>
				</div>
				{hasMore ? (
					<Button
						variant="ghost"
						size="sm"
						className="self-start"
						onClick={() => setShowFull((value) => !value)}
					>
						{showFull
							? "Show only the new text"
							: "Show the full email, with quoted text"}
					</Button>
				) : null}
			</div>
		</>
	);
}
