"use client";

import { Button } from "@crm/ui/components/button";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileSheet } from "@/components/linkedin-scraper/profile-sheet";
import { ScraperPage } from "@/components/linkedin-scraper/scraper-page";
import { LocalDateTime } from "@/components/local-date-time";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { profilesApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys } from "@/lib/linkedin-scraper/cache";
import { QUEUE_STATUS } from "@/lib/linkedin-scraper/labels";
import {
	QUEUE_STATUSES,
	type QueueStatus,
	type ScrapedProfile,
} from "@/lib/linkedin-scraper/schemas";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { DATE_ONLY } from "@/lib/outreach/format";
import { useDebounced } from "@/lib/outreach/use-debounced";

type StatusFilter = typeof ALL | QueueStatus;

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
	{ value: ALL, label: "Every status" },
	...QUEUE_STATUSES.map((status) => ({
		value: status,
		label: QUEUE_STATUS[status].label,
	})),
];

export function ProfilesView() {
	const download = useMutation({
		mutationFn: () => profilesApi.download(),
		onSuccess: (filename) => toast.success(`Downloaded ${filename}.`),
		onError: (error) => toast.error(error.message),
	});

	return (
		<ScraperPage
			title="Profiles"
			description="Every person the scraper has read, with the product the AI matched."
			actions={
				<Button
					variant="outline"
					size="sm"
					disabled={download.isPending}
					onClick={() => download.mutate()}
				>
					Download Excel
				</Button>
			}
		>
			<ProfilesBody />
		</ScraperPage>
	);
}

function matches(profile: ScrapedProfile, query: string): boolean {
	if (!query) return true;
	return [
		profile.name,
		profile.headline,
		profile.company,
		profile.jobTitle,
		profile.location,
		profile.productName,
	].some((value) => value.toLowerCase().includes(query));
}

function ProfilesBody() {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>(ALL);
	const [product, setProduct] = useState<string>(ALL);
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<ScrapedProfile | null>(null);
	const query = useDebounced(search, LINKEDIN_SCRAPER.searchDebounceMs)
		.trim()
		.toLowerCase();

	const profiles = useQuery({
		queryKey: scraperKeys.profiles,
		queryFn: () => profilesApi.list(),
		refetchInterval: LINKEDIN_SCRAPER.refresh.listMs,
	});

	const all = profiles.data?.profiles ?? [];
	const productOptions = [
		{ value: ALL, label: "Every product" },
		...[...new Set(all.map((profile) => profile.productName).filter(Boolean))]
			.sort()
			.map((name) => ({ value: name, label: name })),
	];
	const filtered = all.filter(
		(profile) =>
			(status === ALL || profile.queueStatus === status) &&
			(product === ALL || profile.productName === product) &&
			matches(profile, query),
	);
	const { pageSize } = LINKEDIN_SCRAPER;
	const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

	return (
		<div className="flex flex-col gap-4">
			<OutreachToolbar>
				<SearchBox
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
					placeholder="Search name, company or title"
				/>
				<FilterSelect
					value={status}
					onChange={(value) => {
						setStatus(value);
						setPage(1);
					}}
					options={STATUS_OPTIONS}
					label="Status"
				/>
				<FilterSelect
					value={product}
					onChange={(value) => {
						setProduct(value);
						setPage(1);
					}}
					options={productOptions}
					label="Product"
				/>
			</OutreachToolbar>

			{profiles.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : profiles.isError ? (
				<p className="text-destructive text-xs">{profiles.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{all.length === 0 ? "No profiles yet" : "No match"}
						</EmptyTitle>
						<EmptyDescription>
							{all.length === 0
								? "Start a scrape on Search and scrape. Profiles appear here as they are read."
								: "Change the search or the filters."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "name", header: "Person" },
						{ id: "company", header: "Company" },
						{ id: "product", header: "Product" },
						{ id: "score", header: "Match" },
						{ id: "status", header: "Status" },
						{ id: "scraped", header: "Scraped" },
					]}
				>
					{rows.map((profile) => {
						const label = QUEUE_STATUS[profile.queueStatus];
						return (
							<SimpleTableRow
								key={profile.slug}
								clickable
								onClick={() => setOpen(profile)}
							>
								<TableCell className="max-w-64 px-3">
									<p className="truncate">{profile.name || profile.slug}</p>
									<p className="truncate text-muted-foreground text-xs">
										{profile.jobTitle || profile.headline}
									</p>
								</TableCell>
								<TableCell className="max-w-48 truncate px-3">
									{profile.company || "—"}
								</TableCell>
								<TableCell className="px-3">
									{profile.productName || "—"}
								</TableCell>
								<TableCell className="px-3 tabular-nums">
									{profile.relevanceScore ?? "—"}
								</TableCell>
								<TableCell className="px-3">
									<StatusIndicator
										tone={label.tone}
										label={label.label}
										size="sm"
									/>
								</TableCell>
								<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
									{profile.scrapedAt ? (
										<LocalDateTime
											date={profile.scrapedAt}
											options={DATE_ONLY}
										/>
									) : (
										"—"
									)}
								</TableCell>
							</SimpleTableRow>
						);
					})}
				</SimpleTable>
			)}

			{filtered.length > pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(filtered.length / pageSize)}
					pageSize={pageSize}
					total={filtered.length}
					onPageChange={setPage}
					loading={profiles.isFetching}
				/>
			) : null}

			<ProfileSheet profile={open} onClose={() => setOpen(null)} />
		</div>
	);
}
