"use client";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { OutreachStatus } from "@/components/outreach/status";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
} from "@/components/outreach/toolbar";
import { LocalLinksBanner } from "@/components/outreach/tracking-links";
import { audienceApi, mailApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { CLICK_VERDICT } from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { ClickFilter } from "@/lib/outreach/schemas/enums";

const PICKER_LIMIT = 100;

const INCLUDE_OPTIONS: { value: ClickFilter; label: string }[] = [
	{ value: "real", label: "Real clicks only" },
	{ value: "real-and-maybe", label: "Real and maybe a bot" },
	{ value: "all", label: "Everything, bots too" },
];

export function ClicksTab() {
	const [include, setInclude] = useState<ClickFilter>("real");
	const [listId, setListId] = useState<string>(ALL);
	const [page, setPage] = useState(1);

	const lists = useQuery({
		queryKey: [...outreachKeys.lists, "picker"],
		queryFn: () => audienceApi.lists({ page: 1, limit: PICKER_LIMIT }),
	});
	const clicks = useQuery({
		queryKey: [...outreachKeys.tracking, "clicks", { include, listId, page }],
		queryFn: () =>
			mailApi.clicks({
				include,
				listId: listId === ALL ? undefined : listId,
				page,
				limit: OUTREACH.pageSize,
			}),
		placeholderData: (previous) => previous,
		refetchInterval: OUTREACH.refresh.listMs,
	});

	const listOptions = [
		{ value: ALL, label: "All lists" },
		...(lists.data?.data ?? []).map((list) => ({
			value: list.id,
			label: `${list.name} (${COUNT.format(list.contactCount)})`,
		})),
	];
	const rows = clicks.data?.data ?? [];
	const total = clicks.data?.total ?? 0;

	return (
		<div className="flex flex-col gap-4">
			<LocalLinksBanner />
			<p className="text-muted-foreground text-xs">
				Company email security often opens every link by itself seconds after
				the email arrives. Each click gets a verdict with the reason, so you can
				tell a person from a scanner. Clicks are kept for one year.
			</p>
			<OutreachToolbar>
				<FilterSelect
					value={include}
					onChange={(value) => {
						setInclude(value);
						setPage(1);
					}}
					options={INCLUDE_OPTIONS}
					label="Which clicks"
				/>
				<FilterSelect
					value={listId}
					onChange={(value) => {
						setListId(value);
						setPage(1);
					}}
					options={listOptions}
					label="List"
				/>
			</OutreachToolbar>

			{clicks.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : clicks.isError ? (
				<p className="text-destructive text-xs">{clicks.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No clicks yet</EmptyTitle>
						<EmptyDescription>
							Clicks appear here when someone opens their tracking link.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "when", header: "When" },
						{ id: "who", header: "Who" },
						{ id: "verdict", header: "Verdict" },
						{ id: "why", header: "Why" },
						{ id: "to", header: "Went to" },
					]}
				>
					{rows.map((click) => (
						<SimpleTableRow key={click.id}>
							<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
								<LocalDateTime date={click.at} options={DATE_TIME} />
							</TableCell>
							<TableCell className="px-3">
								<p>
									{click.contact?.name || click.contact?.email || "Unknown"}
								</p>
								{click.contact?.name ? (
									<p className="text-muted-foreground text-xs">
										{click.contact.email}
									</p>
								) : null}
							</TableCell>
							<TableCell className="px-3">
								<OutreachStatus status={CLICK_VERDICT[click.verdict]} />
							</TableCell>
							<TableCell className="max-w-72 px-3 text-muted-foreground text-xs">
								{click.reasons.join(" ") || "—"}
							</TableCell>
							<TableCell className="max-w-56 truncate px-3 text-muted-foreground text-xs">
								{click.destinationUrl}
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
					loading={clicks.isFetching}
				/>
			) : null}
		</div>
	);
}
