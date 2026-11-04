"use client";

import { Button } from "@crm/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Input } from "@crm/ui/components/input";
import { Link as TextLink } from "@crm/ui/components/link";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ScraperPage } from "@/components/linkedin-scraper/scraper-page";
import { LocalDateTime } from "@/components/local-date-time";
import { OutreachToolbar } from "@/components/outreach/toolbar";
import { reportsApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys } from "@/lib/linkedin-scraper/cache";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { useScraperStatus } from "@/lib/linkedin-scraper/use-status";
import { COUNT, keyed, TIME_ONLY } from "@/lib/outreach/format";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function SentView() {
	return (
		<ScraperPage
			title="Sent"
			description="LinkedIn messages sent on one day, with a downloadable report."
		>
			<SentBody />
		</ScraperPage>
	);
}

function SentBody() {
	const status = useScraperStatus();
	const today = status.data?.sendBudget?.date ?? "";
	const [picked, setPicked] = useState("");
	const date = DATE_PATTERN.test(picked) ? picked : today;

	const summary = useQuery({
		queryKey: scraperKeys.sent(date),
		queryFn: () => reportsApi.sentOn(date),
		enabled: DATE_PATTERN.test(date),
		refetchInterval: LINKEDIN_SCRAPER.refresh.listMs,
	});
	const download = useMutation({
		mutationFn: () => reportsApi.downloadSentOn(date),
		onSuccess: (filename) => toast.success(`Downloaded ${filename}.`),
		onError: (error) => toast.error(error.message),
	});

	const data = summary.data;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<OutreachToolbar>
					<Input
						type="date"
						value={date}
						onChange={(event) => setPicked(event.target.value)}
						aria-label="Day"
						className="w-44"
					/>
					{data ? (
						<span className="text-muted-foreground text-xs">
							{COUNT.format(data.count)} sent · days end in {data.timeZone}
						</span>
					) : null}
				</OutreachToolbar>
				<Button
					variant="outline"
					size="sm"
					disabled={!data || data.count === 0 || download.isPending}
					onClick={() => download.mutate()}
				>
					Download Excel
				</Button>
			</div>

			{!DATE_PATTERN.test(date) ? (
				<p className="text-muted-foreground text-xs">Pick a day.</p>
			) : summary.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : summary.isError ? (
				<p className="text-destructive text-xs">{summary.error.message}</p>
			) : data && data.items.length > 0 ? (
				<SimpleTable
					columns={[
						{ id: "time", header: "Time" },
						{ id: "name", header: "Person" },
						{ id: "product", header: "Product" },
						{ id: "message", header: "Message" },
					]}
				>
					{keyed(data.items, "sent").map(({ id, item }) => (
						<SimpleTableRow key={id}>
							<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
								{item.messageSentAt ? (
									<LocalDateTime
										date={item.messageSentAt}
										options={TIME_ONLY}
									/>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="max-w-56 truncate px-3">
								{item.profileUrl ? (
									<TextLink
										href={item.profileUrl}
										target="_blank"
										rel="noreferrer"
									>
										{item.name || item.profileUrl}
									</TextLink>
								) : (
									item.name || "—"
								)}
							</TableCell>
							<TableCell className="whitespace-nowrap px-3">
								{item.productName || "—"}
							</TableCell>
							<TableCell className="max-w-md truncate px-3 text-muted-foreground">
								{item.message}
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			) : (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>Nothing sent on this day</EmptyTitle>
						<EmptyDescription>
							Messages appear here after the queue sends them.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	);
}
