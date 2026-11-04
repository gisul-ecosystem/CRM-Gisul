"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
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
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { JobLog } from "@/components/linkedin-scraper/job-log";
import { ScraperPage } from "@/components/linkedin-scraper/scraper-page";
import { LocalDateTime } from "@/components/local-date-time";
import { Meter } from "@/components/outreach/meter";
import { scrapeApi, scraperApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys, useScraperCache } from "@/lib/linkedin-scraper/cache";
import { JOB_STATUS } from "@/lib/linkedin-scraper/labels";
import {
	CONNECTION_TYPE_IDS,
	type ConnectionTypeId,
	type ScrapeFilters,
} from "@/lib/linkedin-scraper/schemas";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { useScraperStatus } from "@/lib/linkedin-scraper/use-status";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";

type Options = Pick<
	ScrapeFilters,
	"maxResults" | "startIndex" | "products" | "aiMessages" | "rescrape"
>;

const DEFAULT_OPTIONS: Options = {
	maxResults: LINKEDIN_SCRAPER.scrape.defaultMaxResults,
	startIndex: 0,
	products: [],
	aiMessages: true,
	rescrape: false,
};

export function ScrapeView() {
	return (
		<ScraperPage
			title="Search and scrape"
			description="Find people on LinkedIn, read their profiles, and queue an AI draft for each one. Nothing is sent from here."
		>
			<ScrapeBody />
		</ScraperPage>
	);
}

function ScrapeBody() {
	const status = useScraperStatus();
	const job = status.data?.scrapeJob;
	const busy =
		job?.status === "running" || status.data?.sendJob.status === "running";

	return (
		<div className="flex flex-col gap-6">
			{status.data && !status.data.linkedInConnected ? (
				<Alert variant="warning">
					<AlertTitle>LinkedIn is not connected</AlertTitle>
					<AlertDescription>
						Connect LinkedIn on the LinkedIn overview before you start a scrape.
					</AlertDescription>
				</Alert>
			) : null}

			<div className="grid gap-6 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>New scrape</CardTitle>
						<CardDescription>
							Search LinkedIn, or import a file of profile links.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs defaultValue="search" className="gap-4">
							<TabsList>
								<TabsTrigger value="search">LinkedIn search</TabsTrigger>
								<TabsTrigger value="import">Import a file</TabsTrigger>
							</TabsList>
							<TabsContent value="search">
								<SearchForm disabled={busy} />
							</TabsContent>
							<TabsContent value="import">
								<ImportForm disabled={busy} />
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Current scrape</CardTitle>
						<CardDescription>
							One scrape runs at a time, for everyone.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{job ? (
							<>
								<div className="flex items-center justify-between gap-2">
									<StatusIndicator
										tone={JOB_STATUS[job.status].tone}
										label={JOB_STATUS[job.status].label}
										pulse={job.status === "running"}
										size="sm"
									/>
									{job.total > 0 ? (
										<span className="text-muted-foreground text-xs tabular-nums">
											{COUNT.format(job.processed)} / {COUNT.format(job.total)}
										</span>
									) : null}
								</div>
								{job.total > 0 ? (
									<Meter
										value={job.processed}
										max={job.total}
										label="Scrape progress"
									/>
								) : null}
								<p className="text-muted-foreground text-xs">
									{COUNT.format(job.queued)} drafts queued ·{" "}
									{COUNT.format(job.skipped)} skipped
									{job.current ? ` · Now: ${job.current}` : ""}
								</p>
								{job.error ? (
									<p className="text-destructive text-xs">{job.error}</p>
								) : null}
								<JobLog entries={job.logs} />
							</>
						) : null}
					</CardContent>
				</Card>
			</div>

			<History />
		</div>
	);
}

function useOptionsFields(prefix: string) {
	const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
	const products = useQuery({
		queryKey: scraperKeys.products,
		queryFn: () => scraperApi.products(),
		staleTime: LINKEDIN_SCRAPER.refresh.listMs,
	});
	const maxId = useId();
	const startId = useId();

	const toggleProduct = (id: string) =>
		setOptions((current) => ({
			...current,
			products: current.products.includes(id)
				? current.products.filter((value) => value !== id)
				: [...current.products, id],
		}));

	const fields = (
		<>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={maxId}>How many people</FieldLabel>
					<Input
						id={maxId}
						type="number"
						min={1}
						max={LINKEDIN_SCRAPER.scrape.maxResults}
						value={options.maxResults}
						onChange={(event) =>
							setOptions((current) => ({
								...current,
								maxResults: Number(event.target.value),
							}))
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={startId}>Skip the first</FieldLabel>
					<Input
						id={startId}
						type="number"
						min={0}
						value={options.startIndex}
						onChange={(event) =>
							setOptions((current) => ({
								...current,
								startIndex: Number(event.target.value),
							}))
						}
					/>
				</Field>
			</div>
			<Field>
				<FieldLabel>Products to match</FieldLabel>
				<div className="grid gap-3 sm:grid-cols-3">
					{(products.data?.products ?? []).map((product) => (
						<Field key={`${prefix}-${product.id}`} orientation="horizontal">
							<Checkbox
								checked={options.products.includes(product.id)}
								onCheckedChange={() => toggleProduct(product.id)}
								aria-label={product.name}
							/>
							<FieldLabel>{product.name}</FieldLabel>
						</Field>
					))}
				</div>
				<FieldDescription>
					Tick none to let the AI choose from every product.
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={options.aiMessages}
					onCheckedChange={(checked) =>
						setOptions((current) => ({
							...current,
							aiMessages: checked === true,
						}))
					}
					aria-label="Write an AI draft for each person"
				/>
				<FieldLabel>Write an AI draft for each person</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={options.rescrape}
					onCheckedChange={(checked) =>
						setOptions((current) => ({
							...current,
							rescrape: checked === true,
						}))
					}
					aria-label="Read profiles again that were already scraped"
				/>
				<FieldLabel>Read profiles again that were already scraped</FieldLabel>
			</Field>
		</>
	);

	return { options, fields };
}

function SearchForm({ disabled }: { disabled: boolean }) {
	const cache = useScraperCache();
	const { options, fields } = useOptionsFields("search");
	const [connectionType, setConnectionType] =
		useState<ConnectionTypeId>("all_connections");
	const [keywords, setKeywords] = useState("");
	const [title, setTitle] = useState("");
	const [company, setCompany] = useState("");
	const [location, setLocation] = useState("");
	const [profileUrl, setProfileUrl] = useState("");
	const types = useQuery({
		queryKey: scraperKeys.connectionTypes,
		queryFn: () => scraperApi.connectionTypes(),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const typeId = useId();
	const keywordsId = useId();
	const titleId = useId();
	const companyId = useId();
	const locationId = useId();
	const profileId = useId();

	const start = useMutation({
		mutationFn: () =>
			scrapeApi.start({
				...options,
				connectionType,
				keywords: keywords.trim(),
				title: title.trim(),
				company: company.trim(),
				location: location.trim(),
				profileUrl: profileUrl.trim(),
			}),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.scrape();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				start.mutate();
			}}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={typeId}>Who to search</FieldLabel>
					<Select
						value={connectionType}
						onValueChange={(next) => {
							const match = CONNECTION_TYPE_IDS.find((id) => id === next);
							if (match) setConnectionType(match);
						}}
					>
						<SelectTrigger id={typeId}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CONNECTION_TYPE_IDS.map((id) => (
								<SelectItem key={id} value={id}>
									{types.data?.[id]?.label ?? id}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>
						{types.data?.[connectionType]?.description}
					</FieldDescription>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor={keywordsId}>Keywords</FieldLabel>
						<Input
							id={keywordsId}
							value={keywords}
							onChange={(event) => setKeywords(event.target.value)}
							placeholder="L&D head"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={titleId}>Job title</FieldLabel>
						<Input
							id={titleId}
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={companyId}>Company</FieldLabel>
						<Input
							id={companyId}
							value={company}
							onChange={(event) => setCompany(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={locationId}>Location</FieldLabel>
						<Input
							id={locationId}
							value={location}
							onChange={(event) => setLocation(event.target.value)}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor={profileId}>One profile only</FieldLabel>
					<Input
						id={profileId}
						value={profileUrl}
						onChange={(event) => setProfileUrl(event.target.value)}
						placeholder="https://www.linkedin.com/in/username"
					/>
					<FieldDescription>
						A profile link here replaces the search.
					</FieldDescription>
				</Field>
				{fields}
			</FieldGroup>
			<div>
				<Button type="submit" disabled={disabled || start.isPending}>
					Start scrape
				</Button>
			</div>
		</form>
	);
}

function ImportForm({ disabled }: { disabled: boolean }) {
	const cache = useScraperCache();
	const { options, fields } = useOptionsFields("import");
	const [file, setFile] = useState<File | null>(null);
	const fileId = useId();

	const start = useMutation({
		mutationFn: (picked: File) => scrapeApi.importFile(picked, options),
		onSuccess: (result) => {
			toast.success(
				`${result.message}. ${COUNT.format(result.willProcess)} of ${COUNT.format(result.found)} profiles.`,
			);
			void cache.scrape();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (file) start.mutate(file);
			}}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={fileId}>CSV or Excel file</FieldLabel>
					<Input
						id={fileId}
						type="file"
						accept=".csv,.xlsx,.xls,text/csv"
						onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					/>
					<FieldDescription>
						A LinkedIn connections export, or any sheet with linkedin.com/in/
						links. At most 40 MB.
					</FieldDescription>
				</Field>
				{fields}
			</FieldGroup>
			<div>
				<Button type="submit" disabled={disabled || !file || start.isPending}>
					Import and scrape
				</Button>
			</div>
		</form>
	);
}

function History() {
	const jobs = useQuery({
		queryKey: scraperKeys.jobs,
		queryFn: () => scrapeApi.history(),
		refetchInterval: LINKEDIN_SCRAPER.refresh.listMs,
	});

	const rows = (jobs.data?.jobs ?? []).slice(
		0,
		LINKEDIN_SCRAPER.scrape.historyLimit,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Past scrapes</CardTitle>
				<CardDescription>The latest scrapes, newest first.</CardDescription>
			</CardHeader>
			<CardContent>
				{jobs.isError ? (
					<p className="text-destructive text-xs">{jobs.error.message}</p>
				) : rows.length === 0 ? (
					<p className="text-muted-foreground text-xs">No scrape yet.</p>
				) : (
					<SimpleTable
						columns={[
							{ id: "started", header: "Started" },
							{ id: "search", header: "Search" },
							{ id: "progress", header: "Profiles" },
							{ id: "status", header: "Status" },
						]}
					>
						{rows.map((row) => (
							<SimpleTableRow key={row.jobId}>
								<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
									{row.startedAt ? (
										<LocalDateTime date={row.startedAt} options={DATE_TIME} />
									) : (
										"—"
									)}
								</TableCell>
								<TableCell className="max-w-72 truncate px-3">
									{[
										row.filters.keywords,
										row.filters.title,
										row.filters.company,
										row.filters.location,
									]
										.filter(Boolean)
										.join(" · ") ||
										row.filters.connectionType ||
										"—"}
								</TableCell>
								<TableCell className="px-3 tabular-nums">
									{COUNT.format(row.processed)} / {COUNT.format(row.total)}
								</TableCell>
								<TableCell className="px-3">
									<StatusIndicator
										tone={JOB_STATUS[row.status].tone}
										label={JOB_STATUS[row.status].label}
										size="sm"
									/>
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</CardContent>
		</Card>
	);
}
