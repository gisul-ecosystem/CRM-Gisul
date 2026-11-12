"use client";

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
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ProfileSheet } from "@/components/linkedin-scraper/profile-sheet";
import { ScraperPage } from "@/components/linkedin-scraper/scraper-page";
import { LocalDateTime } from "@/components/local-date-time";
import { OutreachToolbar, SearchBox } from "@/components/outreach/toolbar";
import { profilesApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys } from "@/lib/linkedin-scraper/cache";
import { QUEUE_STATUS } from "@/lib/linkedin-scraper/labels";
import type { ScrapedProfile } from "@/lib/linkedin-scraper/schemas";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { DATE_ONLY } from "@/lib/outreach/format";
import { useDebounced } from "@/lib/outreach/use-debounced";

type FoundPost = ScrapedProfile & {
	sourcePost: NonNullable<ScrapedProfile["sourcePost"]>;
};

function hasPost(profile: ScrapedProfile): profile is FoundPost {
	return profile.sourcePost !== null;
}

function matches(found: FoundPost, query: string): boolean {
	if (!query) return true;
	return [
		found.name,
		found.headline,
		found.sourcePost.text,
		found.sourcePost.keywords,
		found.sourcePost.intentSignal,
		found.productName,
	].some((value) => value.toLowerCase().includes(query));
}

export function PostsView() {
	return (
		<ScraperPage
			title="Found posts"
			description="Posts where the AI found a need for our products, newest first. Click a row to see the post and the draft."
		>
			<PostsBody />
		</ScraperPage>
	);
}

function PostsBody() {
	const [search, setSearch] = useState("");
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

	const all = (profiles.data?.profiles ?? [])
		.filter(hasPost)
		.sort((a, b) =>
			(b.sourcePost.foundAt ?? "").localeCompare(a.sourcePost.foundAt ?? ""),
		);
	const filtered = all.filter((found) => matches(found, query));
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
					placeholder="Search post text, person or keywords"
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
							{all.length === 0 ? "No posts found yet" : "No match"}
						</EmptyTitle>
						<EmptyDescription>
							{all.length === 0
								? "Run a search on Search and scrape → Posts. Posts that show a need appear here."
								: "Change the search."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "post", header: "Post" },
						{ id: "person", header: "Person" },
						{ id: "need", header: "Need" },
						{ id: "product", header: "Product" },
						{ id: "status", header: "Status" },
						{ id: "found", header: "Found" },
					]}
				>
					{rows.map((found) => {
						const label = QUEUE_STATUS[found.queueStatus];
						return (
							<SimpleTableRow
								key={found.slug}
								clickable
								onClick={() => setOpen(found)}
							>
								<TableCell className="max-w-96 px-3">
									<p className="truncate">{found.sourcePost.text}</p>
									<p className="truncate text-muted-foreground text-xs">
										{found.sourcePost.intentSignal ||
											found.sourcePost.intentReason}
									</p>
								</TableCell>
								<TableCell className="max-w-56 px-3">
									<p className="truncate">{found.name || found.slug}</p>
									<p className="truncate text-muted-foreground text-xs">
										{found.jobTitle || found.headline}
									</p>
								</TableCell>
								<TableCell className="px-3 tabular-nums">
									{found.sourcePost.intentScore}
								</TableCell>
								<TableCell className="px-3">
									{found.productName || "—"}
								</TableCell>
								<TableCell className="px-3">
									<StatusIndicator
										tone={label.tone}
										label={label.label}
										size="sm"
									/>
								</TableCell>
								<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
									{found.sourcePost.foundAt ? (
										<LocalDateTime
											date={found.sourcePost.foundAt}
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
