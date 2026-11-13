"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { PipelinePage } from "@/components/leads-pipeline/pipeline-page";
import { RunLog } from "@/components/leads-pipeline/run-log";
import { BrowserViewer } from "@/components/linkedin-scraper/browser-viewer";
import { LocalDateTime } from "@/components/local-date-time";
import { customSearchApi } from "@/lib/leads-pipeline/api";
import { pipelineKeys, usePipelineCache } from "@/lib/leads-pipeline/cache";
import { LEADS_PIPELINE } from "@/lib/leads-pipeline/pipeline-config";
import {
	type CustomSearchInput,
	type CustomSearchList,
	type ProfileStatus,
	SEARCH_MODES,
	type SearchMode,
} from "@/lib/leads-pipeline/schemas";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
	browser: "Google in the search browser",
	api: "Search API (Serper, then Tavily)",
};

function lines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function words(value: string): string[] {
	return value
		.split(",")
		.map((word) => word.trim())
		.filter(Boolean);
}

export function CustomSearchView({ viewerSrc }: { viewerSrc: string | null }) {
	return (
		<PipelinePage
			title="Custom search"
			description="Describe the companies you want. The pipeline searches the web in its own browser, reads each website, finds people and emails, and scores them."
		>
			{(profile) => (
				<CustomSearchBody
					key={profile.profile}
					status={profile}
					viewerSrc={viewerSrc}
				/>
			)}
		</PipelinePage>
	);
}

function CustomSearchBody({
	status,
	viewerSrc,
}: {
	status: ProfileStatus;
	viewerSrc: string | null;
}) {
	const list = useQuery({
		queryKey: pipelineKeys.customSearches(status.profile),
		queryFn: () => customSearchApi.list(status.profile),
		refetchInterval: status.running
			? LEADS_PIPELINE.refresh.runningMs
			: LEADS_PIPELINE.refresh.idleMs,
	});

	if (list.isPending) return <Skeleton className="h-96 w-full rounded-lg" />;
	if (list.isError) {
		return <p className="text-destructive text-xs">{list.error.message}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-6 xl:grid-cols-2">
				<SearchForm status={status} limits={list.data.limits} />
				<Card>
					<CardHeader>
						<CardTitle>Run log</CardTitle>
						<CardDescription>
							{status.running
								? "A run is in progress. The newest lines first."
								: "The newest lines first."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<RunLog profile={status.profile} running={status.running} />
					</CardContent>
				</Card>
			</div>
			{status.running ? (
				<Card>
					<CardHeader>
						<CardTitle>Search browser</CardTitle>
						<CardDescription>
							{viewerSrc
								? "The pipeline's own Chromium. When a search engine shows a check, solve it here; the search goes on by itself. Don't use it for anything else."
								: "Set LEADS_PIPELINE_VIEWER_URL to watch the search browser here and solve search engine checks."}
						</CardDescription>
					</CardHeader>
					{viewerSrc ? (
						<CardContent className="flex flex-col gap-2">
							<BrowserViewer src={viewerSrc} title="Custom search browser" />
							<a
								href={viewerSrc}
								target="_blank"
								rel="noreferrer"
								className="text-muted-foreground text-xs underline"
							>
								Open in a new tab
							</a>
						</CardContent>
					) : null}
				</Card>
			) : null}
			<PastSearches status={status} searches={list.data.searches} />
		</div>
	);
}

function SearchForm({
	status,
	limits,
}: {
	status: ProfileStatus;
	limits: CustomSearchList["limits"];
}) {
	const cache = usePipelineCache();
	const [name, setName] = useState("");
	const [what, setWhat] = useState("");
	const [where, setWhere] = useState("");
	const [mustHave, setMustHave] = useState("");
	const [exclude, setExclude] = useState("");
	const [companies, setCompanies] = useState(limits.default_companies);
	const [searchWith, setSearchWith] = useState<SearchMode>("browser");
	const [preview, setPreview] = useState<string[] | null>(null);
	const ids = {
		name: useId(),
		what: useId(),
		where: useId(),
		must: useId(),
		exclude: useId(),
		companies: useId(),
		searchWith: useId(),
	};

	const input = (): CustomSearchInput => ({
		profile: status.profile,
		name: name.trim(),
		what: lines(what),
		where: lines(where),
		mustHave: words(mustHave),
		exclude: words(exclude),
		companies,
		searchWith,
	});

	const showPreview = useMutation({
		mutationFn: () => customSearchApi.preview(input()),
		onSuccess: (result) => setPreview(result.queries),
		onError: (error) => toast.error(error.message),
	});

	const start = useMutation({
		mutationFn: () => customSearchApi.start(input()),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.run(status.profile);
		},
		onError: (error) => toast.error(error.message),
	});

	const reset = () => setPreview(null);
	const ready = name.trim() !== "" && lines(what).length > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>New search</CardTitle>
				<CardDescription>
					Uses the {status.label} rules from Settings: segments, countries and
					scoring.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						start.mutate();
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={ids.name}>Name</FieldLabel>
							<Input
								id={ids.name}
								maxLength={limits.max_name_chars}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="VFX studios, November"
							/>
							<FieldDescription>
								Leads from this search get this name, so you can filter them on
								the Leads page.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.what}>What to find</FieldLabel>
							<Textarea
								id={ids.what}
								rows={4}
								value={what}
								onChange={(event) => {
									setWhat(event.target.value);
									reset();
								}}
								placeholder={
									"VFX studio\nanimation studio\nAI drug discovery startup"
								}
							/>
							<FieldDescription>
								One kind of company per line, at most {limits.max_what}.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.where}>Where</FieldLabel>
							<Textarea
								id={ids.where}
								rows={3}
								value={where}
								onChange={(event) => {
									setWhere(event.target.value);
									reset();
								}}
								placeholder={"Pune\nBengaluru\nKuala Lumpur"}
							/>
							<FieldDescription>
								One city or country per line, at most {limits.max_where}. Leave
								it empty to search without a place. Each line of What is
								searched in each place, at most {limits.max_queries} searches.
							</FieldDescription>
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor={ids.must}>Must mention</FieldLabel>
								<Input
									id={ids.must}
									value={mustHave}
									onChange={(event) => setMustHave(event.target.value)}
									placeholder="GPU, render, CUDA"
								/>
								<FieldDescription>
									Comma separated. A result needs one of them in its title or
									summary.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor={ids.exclude}>Leave out</FieldLabel>
								<Input
									id={ids.exclude}
									value={exclude}
									onChange={(event) => setExclude(event.target.value)}
									placeholder="jobs, course, review"
								/>
								<FieldDescription>
									Comma separated. A result with any of them is skipped.
								</FieldDescription>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor={ids.companies}>
								How many companies
							</FieldLabel>
							<Input
								id={ids.companies}
								type="number"
								min={1}
								max={limits.max_companies}
								value={companies}
								onChange={(event) => setCompanies(Number(event.target.value))}
							/>
							<FieldDescription>
								At most {limits.max_companies}. Each company takes about a
								minute to read and check.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.searchWith}>Search with</FieldLabel>
							<Select
								value={searchWith}
								onValueChange={(next) => {
									const match = SEARCH_MODES.find((mode) => mode === next);
									if (match) setSearchWith(match);
								}}
							>
								<SelectTrigger id={ids.searchWith}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SEARCH_MODES.map((mode) => (
										<SelectItem key={mode} value={mode}>
											{SEARCH_MODE_LABELS[mode]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								{searchWith === "browser"
									? 'Chromium opens google.com and types each search. If Google asks "I\'m not a robot", tick it in the Search browser below; after 5 minutes it moves on to DuckDuckGo, then the search API.'
									: "Serper (Google results), then Tavily. The browser is the fallback when both are out of credit."}{" "}
								Websites named in the search, and Racko, KanonKode, Aaptor and
								Gisul, are never returned.
							</FieldDescription>
						</Field>
					</FieldGroup>

					{preview ? (
						<div className="flex flex-col gap-2">
							<p className="text-sm">
								{COUNT.format(preview.length)} of {limits.max_queries} searches:
							</p>
							<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
								{preview.map((query) => (
									<li key={query}>{query}</li>
								))}
							</ul>
						</div>
					) : null}

					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={!ready || showPreview.isPending}
							onClick={() => showPreview.mutate()}
						>
							Preview searches
						</Button>
						<Button
							type="submit"
							disabled={!ready || status.running || start.isPending}
						>
							{status.running ? "A run is in progress" : "Start search"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function PastSearches({
	status,
	searches,
}: {
	status: ProfileStatus;
	searches: CustomSearchList["searches"];
}) {
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Past searches</CardTitle>
				<CardDescription>
					Newest first. Companies found counts websites before they are read and
					checked.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{searches.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyTitle>No custom searches yet</EmptyTitle>
							<EmptyDescription>
								Start one with the form above.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<SimpleTable
						columns={[
							{ id: "name", header: "Search" },
							{ id: "searches", header: "Searches", align: "right" },
							{ id: "found", header: "Companies found", align: "right" },
							{ id: "started", header: "Started" },
							{ id: "open", srLabel: "Open" },
						]}
					>
						{searches.map((search) => (
							<SimpleTableRow key={`${search.slug}-${search.startedAt}`}>
								<TableCell className="max-w-72 px-3">
									<p className="truncate">{search.name}</p>
									<p className="truncate text-muted-foreground text-xs">
										{search.what.join(", ")}
										{search.where.length ? ` · ${search.where.join(", ")}` : ""}
									</p>
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{search.searched ?? "—"} / {search.queries.length}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{search.found ?? "running"}
								</TableCell>
								<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
									<LocalDateTime date={search.startedAt} options={DATE_TIME} />
								</TableCell>
								<TableCell className="px-3 text-right">
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											router.push(
												workspaceUrl(
													`/lead-generation/leads?profile=${status.profile}&source=${encodeURIComponent(search.slug)}`,
												),
											)
										}
									>
										View leads
									</Button>
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</CardContent>
		</Card>
	);
}
