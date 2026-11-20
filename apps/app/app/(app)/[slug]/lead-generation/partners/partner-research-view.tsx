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
import { Checkbox } from "@crm/ui/components/checkbox";
import { MultiCombobox } from "@crm/ui/components/combobox";
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
	FieldLegend,
	FieldSet,
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
import { Switch } from "@crm/ui/components/switch";
import { TableCell } from "@crm/ui/components/table";
import { Textarea } from "@crm/ui/components/textarea";
import { LEAD_ORIGIN_LIMITS } from "@crm/validation/lead-origin";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { PipelineProblem } from "@/components/leads-pipeline/pipeline-page";
import { LogLines } from "@/components/leads-pipeline/run-log";
import { LocalDateTime } from "@/components/local-date-time";
import { FilterSelect } from "@/components/outreach/toolbar";
import { LEAD_SOURCE_OPTIONS } from "@/lib/lead-fields";
import { partnersApi } from "@/lib/leads-pipeline/api";
import { pipelineKeys, usePipelineCache } from "@/lib/leads-pipeline/cache";
import type {
	PartnerOverview,
	PartnerPerson,
	PartnerRow,
	PartnerRun,
	PartnerSearchInput,
} from "@/lib/leads-pipeline/partner-schemas";
import { LEADS_PIPELINE } from "@/lib/leads-pipeline/pipeline-config";
import { scrapeApi } from "@/lib/linkedin-scraper/api";
import { useScraperCache } from "@/lib/linkedin-scraper/cache";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Labels = { [id: string]: string };
type LeadSourceValue = (typeof LEAD_SOURCE_OPTIONS)[number]["value"];

const RUN_STATUS_LABELS = {
	running: "Running",
	done: "Done",
	failed: "Failed",
	stopped: "Stopped",
} as const satisfies { [status in PartnerRun["status"]]: string };

function words(value: string): string[] {
	return value
		.split(",")
		.map((word) => word.trim())
		.filter(Boolean);
}

function labelsOf(options: readonly { id: string; label: string }[]): Labels {
	return Object.fromEntries(options.map((option) => [option.id, option.label]));
}

function listOf(ids: readonly string[], labels: Labels): string {
	return ids.map((id) => labels[id] ?? id).join(", ");
}

export function PartnerResearchPanel() {
	const overview = useQuery({
		queryKey: pipelineKeys.partners,
		queryFn: () => partnersApi.overview(),
		retry: false,
		refetchInterval: (query) =>
			query.state.data?.running
				? LEADS_PIPELINE.refresh.runningMs
				: LEADS_PIPELINE.refresh.idleMs,
	});

	if (overview.isPending) {
		return <Skeleton className="h-96 w-full rounded-lg" />;
	}
	if (overview.isError) return <PipelineProblem error={overview.error} />;
	return <PartnerResearchBody overview={overview.data} />;
}

function PartnerResearchBody({ overview }: { overview: PartnerOverview }) {
	const latest = overview.runs.find((run) => run.status === "done");
	const [openRun, setOpenRun] = useState<string | null>(null);
	const runId = openRun ?? latest?.id ?? null;
	const labels = {
		sectors: labelsOf(overview.options.sectors),
		signals: labelsOf(overview.options.signals),
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-6 xl:grid-cols-2">
				<PartnerForm overview={overview} />
				<Card>
					<CardHeader>
						<CardTitle>Run log</CardTitle>
						<CardDescription>
							{overview.running
								? "A partner research run is in progress. The newest lines first."
								: "The newest lines first."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<PartnerLog running={overview.running} />
					</CardContent>
				</Card>
			</div>
			{runId ? (
				<PartnerResults
					key={runId}
					run={overview.runs.find((run) => run.id === runId) ?? null}
					runId={runId}
					labels={labels}
				/>
			) : null}
			<PastRuns
				runs={overview.runs}
				labels={labels}
				openRun={runId}
				onOpen={setOpenRun}
			/>
		</div>
	);
}

function PartnerLog({ running }: { running: boolean }) {
	const log = useQuery({
		queryKey: pipelineKeys.partnerLog,
		queryFn: () => partnersApi.log(),
		refetchInterval: running
			? LEADS_PIPELINE.refresh.runningMs
			: LEADS_PIPELINE.refresh.idleMs,
	});
	return (
		<LogLines
			lines={log.data?.lines ?? []}
			pending={log.isPending}
			error={log.isError ? log.error.message : null}
		/>
	);
}

function ChoiceGroup({
	legend,
	description,
	options,
	value,
	onChange,
}: {
	legend: string;
	description: string;
	options: readonly { id: string; label: string }[];
	value: readonly string[];
	onChange: (next: string[]) => void;
}) {
	const id = useId();
	const toggle = (choice: string, on: boolean) =>
		onChange(
			options
				.map((option) => option.id)
				.filter((item) => (item === choice ? on : value.includes(item))),
		);

	return (
		<FieldSet>
			<FieldLegend variant="label">{legend}</FieldLegend>
			<div className="grid gap-2 sm:grid-cols-2">
				{options.map((option) => (
					<Field key={option.id} orientation="horizontal">
						<Checkbox
							id={`${id}-${option.id}`}
							checked={value.includes(option.id)}
							onCheckedChange={(checked) => toggle(option.id, checked === true)}
						/>
						<FieldLabel htmlFor={`${id}-${option.id}`}>
							{option.label}
						</FieldLabel>
					</Field>
				))}
			</div>
			<FieldDescription>{description}</FieldDescription>
		</FieldSet>
	);
}

function PartnerForm({ overview }: { overview: PartnerOverview }) {
	const cache = usePipelineCache();
	const { options, limits } = overview;
	const [name, setName] = useState("");
	const [countries, setCountries] = useState<string[]>(options.countries);
	const [sectors, setSectors] = useState<string[]>([]);
	const [signals, setSignals] = useState<string[]>(
		options.signals.map((signal) => signal.id),
	);
	const [months, setMonths] = useState(limits.default_months);
	const [pastWork, setPastWork] = useState("");
	const [mustHave, setMustHave] = useState("");
	const [exclude, setExclude] = useState("");
	const [companies, setCompanies] = useState(limits.default_companies);
	const [useModel, setUseModel] = useState(overview.modelReady);
	const [enrichContacts, setEnrichContacts] = useState(overview.unifersReady);
	const [size, setSize] = useState(limits.default_size);
	const [keepUnknownSize, setKeepUnknownSize] = useState(false);
	const [preview, setPreview] = useState<{
		queries: string[];
		datasets: string[];
	} | null>(null);
	const ids = {
		name: useId(),
		countries: useId(),
		months: useId(),
		pastWork: useId(),
		must: useId(),
		exclude: useId(),
		companies: useId(),
		model: useId(),
		enrich: useId(),
		size: useId(),
		unknownSize: useId(),
	};

	const signalOptions = options.signals.map((signal) => ({
		id: signal.id,
		label: signal.countries.length
			? `${signal.label} (${signal.countries.join(", ")} only)`
			: signal.label,
	}));

	const input = (): PartnerSearchInput => ({
		name: name.trim(),
		countries,
		sectors,
		signals,
		months,
		pastWork: pastWork.trim(),
		mustHave: words(mustHave),
		exclude: words(exclude),
		companies,
		useModel: useModel && overview.modelReady,
		enrichContacts: enrichContacts && overview.unifersReady,
		size,
		keepUnknownSize,
	});
	const anySize = size === "any";

	const showPreview = useMutation({
		mutationFn: () => partnersApi.preview(input()),
		onSuccess: (result) =>
			setPreview({ queries: result.queries, datasets: result.datasets }),
		onError: (error) => toast.error(error.message),
	});

	const start = useMutation({
		mutationFn: () => partnersApi.start(input()),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.partners();
		},
		onError: (error) => toast.error(error.message),
	});

	const stop = useMutation({
		mutationFn: () => partnersApi.stop(),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.partners();
		},
		onError: (error) => toast.error(error.message),
	});

	const change =
		<T,>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPreview(null);
		};

	const ready =
		name.trim() !== "" &&
		countries.length > 0 &&
		sectors.length > 0 &&
		signals.length > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>New partner search</CardTitle>
				<CardDescription>
					Finds system integrators with fresh government work, the person to
					contact, and an opening line. Every fact links to its source.
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
								placeholder="MY + SG government SIs, November"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.countries}>Countries</FieldLabel>
							<MultiCombobox
								id={ids.countries}
								options={options.countries.map((country) => ({
									value: country,
									label: country,
								}))}
								values={countries}
								onValuesChange={change(setCountries)}
								placeholder="Pick one or more countries"
								searchPlaceholder="Search countries…"
							/>
							<FieldDescription>
								Where the partner wins its government work. Pick as many as you
								want. Singapore and United States also read their free
								government awards data.
							</FieldDescription>
						</Field>
						<ChoiceGroup
							legend="Fields"
							description="The work you deliver under the partner. A result must mention one of them."
							options={options.sectors}
							value={sectors}
							onChange={change(setSectors)}
						/>
						<ChoiceGroup
							legend="Signals"
							description="What makes a company a partner now. Government contracts in Singapore and the United States also come from free awards data (GeBIZ, USAspending)."
							options={signalOptions}
							value={signals}
							onChange={change(setSignals)}
						/>
						<Field>
							<FieldLabel htmlFor={ids.months}>Signals since</FieldLabel>
							<Select
								value={String(months)}
								onValueChange={(next) => {
									const match = options.months.find(
										(value) => String(value) === next,
									);
									if (match) change(setMonths)(match);
								}}
							>
								<SelectTrigger id={ids.months}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{options.months.map((value) => (
										<SelectItem key={value} value={String(value)}>
											Last {value} months
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.pastWork}>Our past work</FieldLabel>
							<Textarea
								id={ids.pastWork}
								rows={2}
								maxLength={limits.max_past_work_chars}
								value={pastWork}
								onChange={(event) => setPastWork(event.target.value)}
								placeholder="We delivered the PTPTN data engineering project as the execution team under DB Solve."
							/>
							<FieldDescription>
								One sentence that goes into every opening line. Leave out the
								brand name if you want the pitch to stay neutral.
							</FieldDescription>
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor={ids.must}>Must mention</FieldLabel>
								<Input
									id={ids.must}
									value={mustHave}
									onChange={(event) => change(setMustHave)(event.target.value)}
									placeholder="ministry, Azure"
								/>
								<FieldDescription>
									Comma separated. Added to every search.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor={ids.exclude}>Leave out</FieldLabel>
								<Input
									id={ids.exclude}
									value={exclude}
									onChange={(event) => setExclude(event.target.value)}
									placeholder="construction, property"
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
								At most {limits.max_companies}. Each company costs{" "}
								{anySize ? 2 : 3} searches: its website, its decision maker
								{anySize ? "" : " and its size"}.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.size}>Company size</FieldLabel>
							<Select
								value={size}
								onValueChange={(next) => {
									const match = options.sizes.find((item) => item.id === next);
									if (match) setSize(match.id);
								}}
							>
								<SelectTrigger id={ids.size}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{options.sizes.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								Read from the company's LinkedIn page through a search result.
								LinkedIn sizes come in bands, so "51-200" counts as unknown for
								fewer than 100.
							</FieldDescription>
						</Field>
						{anySize ? null : (
							<Field orientation="horizontal">
								<Checkbox
									id={ids.unknownSize}
									checked={keepUnknownSize}
									onCheckedChange={(checked) =>
										setKeepUnknownSize(checked === true)
									}
								/>
								<FieldLabel htmlFor={ids.unknownSize}>
									Keep companies whose size is unknown
								</FieldLabel>
							</Field>
						)}
						<Field orientation="horizontal">
							<Switch
								id={ids.model}
								checked={useModel && overview.modelReady}
								disabled={!overview.modelReady}
								onCheckedChange={setUseModel}
							/>
							<FieldLabel htmlFor={ids.model}>
								Improve the wording with Claude Haiku
							</FieldLabel>
						</Field>
						<FieldDescription>
							{overview.modelReady
								? "One short call for the top 10 rows. It rewrites only from the facts found; a reply with a new number is thrown away. Rows already written are never sent again."
								: "Off: set the Claude API key (ANTHROPIC_API_KEY) on the Settings page, GPU leads tab. Without it the rows use templates."}
						</FieldDescription>
						<Field orientation="horizontal">
							<Switch
								id={ids.enrich}
								checked={enrichContacts && overview.unifersReady}
								disabled={!overview.unifersReady}
								onCheckedChange={setEnrichContacts}
							/>
							<FieldLabel htmlFor={ids.enrich}>
								Enrich contacts with Unifers
							</FieldLabel>
						</Field>
						<FieldDescription>
							{overview.unifersReady
								? `Each contact found on LinkedIn is looked up in Unifers: current title, employer, location, work email and mobile. A contact who now works elsewhere is dropped. Spends Unifers credits, at most ${limits.unifers_max_people} people a run; a person is looked up again after ${limits.unifers_repeat_days} days.`
								: "Off: set the Unifers API key on the Settings page, GPU leads tab. Without it the contacts keep only their name, title and LinkedIn link."}
						</FieldDescription>
						{overview.searchReady ? null : (
							<p className="text-destructive text-xs">
								No Serper, Tavily or Brave key is set in Settings. The run reads
								only the free GeBIZ data for Singapore.
							</p>
						)}
					</FieldGroup>

					{preview ? (
						<div className="flex flex-col gap-2">
							<p className="text-sm">
								{COUNT.format(preview.queries.length)} of {limits.max_queries}{" "}
								searches
								{preview.datasets.length
									? `, plus ${preview.datasets.join(" and ")}`
									: ""}
								:
							</p>
							<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
								{preview.queries.map((query) => (
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
							disabled={!ready || overview.running || start.isPending}
						>
							{overview.running ? "A run is in progress" : "Start search"}
						</Button>
						{overview.running ? (
							<Button
								type="button"
								variant="outline"
								disabled={stop.isPending}
								onClick={() => stop.mutate()}
							>
								Stop
							</Button>
						) : null}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function personKey(row: PartnerRow, person: PartnerPerson): string {
	return `${row.key}|${person.linkedin}`;
}

function PartnerResults({
	run,
	runId,
	labels,
}: {
	run: PartnerRun | null;
	runId: string;
	labels: { sectors: Labels; signals: Labels };
}) {
	const results = useQuery({
		queryKey: pipelineKeys.partnerResults(runId),
		queryFn: () => partnersApi.results(runId),
	});
	const trpc = useTRPC();
	const crmCache = useCrmCache();
	const scraperCache = useScraperCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [leadSource, setLeadSource] = useState<LeadSourceValue>(
		LEADS_PIPELINE.partners.leadSource,
	);

	const addToCrm = useMutation(
		trpc.contacts.importLeads.mutationOptions({
			onSuccess: async (result) => {
				await Promise.all([crmCache.contact(), crmCache.company()]);
				const parts = [
					result.created > 0 ? `${result.created} added` : null,
					result.existing > 0 ? `${result.existing} already in the CRM` : null,
					result.failed > 0 ? `${result.failed} failed` : null,
				].filter(Boolean);
				toast.success(parts.join(" · ") || "Nothing to add.", {
					action: {
						label: "Open contacts",
						onClick: () => router.push(workspaceUrl("/contacts")),
					},
				});
				setSelected(new Set());
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const queue = useMutation({
		mutationFn: ({ person, hook }: { person: PartnerPerson; hook: string }) =>
			scrapeApi.start({
				...LEADS_PIPELINE.partners.linkedinQueue,
				keywords: "",
				title: "",
				company: "",
				location: "",
				profileUrl: person.linkedin,
				products: [],
				rescrape: false,
				aiMessages: false,
				messageTemplate: hook,
				sendMessages: false,
			}),
		onSuccess: () => {
			toast.success(
				"The LinkedIn scraper is reading the profile. The opening line waits in Messages → LinkedIn queue for your review.",
			);
			void scraperCache.scrape();
		},
		onError: (error) => toast.error(error.message),
	});

	if (results.isPending) return <Skeleton className="h-64 w-full rounded-lg" />;
	if (results.isError) {
		return <p className="text-destructive text-xs">{results.error.message}</p>;
	}

	const rows = results.data.rows;
	const people = rows.flatMap((row) =>
		row.people.map((person) => ({ row, person })),
	);
	const picked = people.filter(({ row, person }) =>
		selected.has(personKey(row, person)),
	);
	const { maxLeads } = LEADS_PIPELINE.addToCrm;

	const toggle = (key: string, on: boolean) =>
		setSelected((current) => {
			const next = new Set(current);
			if (on) next.add(key);
			else next.delete(key);
			return next;
		});

	const submit = () =>
		addToCrm.mutate({
			leadSource,
			category: LEADS_PIPELINE.partners.leadCategory,
			leads: picked.map(({ row, person }) => ({
				fullName: person.name,
				email: person.email,
				phone: person.phone,
				title: person.title,
				company: row.company,
				domain: row.domain,
				linkedinUrl: person.linkedin,
				origin: {
					segment: listOf(row.sectors, labels.sectors).slice(
						0,
						LEAD_ORIGIN_LIMITS.segment,
					),
					country: row.country.slice(0, LEAD_ORIGIN_LIMITS.country),
					signal: row.why.slice(0, LEAD_ORIGIN_LIMITS.signal),
					source: `partners-${run?.slug ?? runId}`.slice(
						0,
						LEAD_ORIGIN_LIMITS.source,
					),
					companySize: row.size.slice(0, LEAD_ORIGIN_LIMITS.companySize),
					opener: row.hook.slice(0, LEAD_ORIGIN_LIMITS.opener),
					evidence: row.evidence
						.slice(0, LEAD_ORIGIN_LIMITS.evidence)
						.map((item) => ({
							title: item.title.slice(0, LEAD_ORIGIN_LIMITS.evidenceTitle),
							url: item.url.slice(0, LEAD_ORIGIN_LIMITS.evidenceUrl),
							source: item.source.slice(0, LEAD_ORIGIN_LIMITS.evidenceField),
							date: item.date.slice(0, LEAD_ORIGIN_LIMITS.evidenceField),
							agency: item.agency.slice(0, LEAD_ORIGIN_LIMITS.evidenceField),
							value: item.value.slice(0, LEAD_ORIGIN_LIMITS.evidenceField),
						})),
				},
			})),
		});

	const copy = (text: string) =>
		navigator.clipboard
			.writeText(text)
			.then(() => toast.success("Opening line copied."))
			.catch(() => toast.error("The browser did not allow copying."));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{run ? run.name : "Results"}</CardTitle>
				<CardDescription>
					Best first. Tick people to add them to the CRM. Check each source
					before you write: the facts come from public pages.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{picked.length > 0 ? (
					<div className="flex flex-wrap items-center gap-3">
						<p className="text-sm">
							{picked.length} selected
							{picked.length > maxLeads
								? ` — add at most ${maxLeads} at a time`
								: ""}
						</p>
						<FilterSelect
							value={leadSource}
							onChange={setLeadSource}
							options={LEAD_SOURCE_OPTIONS}
							label="Lead source"
						/>
						<Button
							size="sm"
							disabled={addToCrm.isPending || picked.length > maxLeads}
							onClick={submit}
						>
							{addToCrm.isPending ? "Adding…" : "Add to CRM contacts"}
						</Button>
					</div>
				) : null}
				{rows.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyTitle>No partners found</EmptyTitle>
							<EmptyDescription>
								{run && run.sizeUnknown + run.sizeTooBig > 0
									? `${run.sizeTooBig} companies were too big and ${run.sizeUnknown} had no size on LinkedIn. Tick "Keep companies whose size is unknown" to see the second group.`
									: "No result named a company with a matching signal. Add fields, add signals, or go back further in time."}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col divide-y rounded-lg border">
						{rows.map((row) => (
							<li key={row.key} className="flex flex-col gap-4 p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="flex min-w-0 flex-col gap-1">
										<p className="font-medium">{row.company}</p>
										<p className="text-muted-foreground text-xs">
											{row.country}
											{row.domain ? (
												<>
													{" · "}
													<a
														href={`https://${row.domain}`}
														target="_blank"
														rel="noreferrer"
														className="underline"
													>
														{row.domain}
													</a>
												</>
											) : null}
											{" · "}
											{row.companyLinkedin ? (
												<a
													href={row.companyLinkedin}
													target="_blank"
													rel="noreferrer"
													className="underline"
												>
													{row.size || "Size not shown"}
												</a>
											) : (
												row.size || "Size unknown"
											)}
											{" · "}
											{listOf(row.sectors, labels.sectors)}
										</p>
									</div>
									<Badge variant="outline">Score {row.score}</Badge>
								</div>
								<div className="grid gap-4 lg:grid-cols-3">
									<div className="flex min-w-0 flex-col gap-1">
										<p className="text-muted-foreground text-xs">Signal</p>
										<p className="text-sm">
											{listOf(row.signals, labels.signals)}
										</p>
										<p className="text-muted-foreground text-xs">
											{[row.value, row.agencies.join(", "), row.date]
												.filter(Boolean)
												.join(" · ")}
										</p>
										<ul className="flex flex-col gap-1 pt-1 text-xs">
											{row.evidence
												.slice(0, LEADS_PIPELINE.partners.evidenceShown)
												.map((evidence) => (
													<li key={evidence.url} className="line-clamp-2">
														<a
															href={evidence.url}
															target="_blank"
															rel="noreferrer"
															className="underline"
															title={evidence.title}
														>
															{evidence.source}
														</a>
														{evidence.title ? ` — ${evidence.title}` : ""}
													</li>
												))}
										</ul>
									</div>
									<div className="flex min-w-0 flex-col gap-1">
										<p className="text-muted-foreground text-xs">
											Contact · {row.contactLevel}
										</p>
										{row.people.length === 0 ? (
											<p className="text-muted-foreground text-xs">
												No person found in search results.
											</p>
										) : (
											<ul className="flex flex-col gap-3 pt-1">
												{row.people.map((person) => {
													const key = personKey(row, person);
													return (
														<li key={key} className="flex items-start gap-2">
															<Checkbox
																checked={selected.has(key)}
																onCheckedChange={(checked) =>
																	toggle(key, checked === true)
																}
																aria-label={`Select ${person.name}`}
															/>
															<div className="flex min-w-0 flex-1 flex-col gap-1">
																<a
																	href={person.linkedin}
																	target="_blank"
																	rel="noreferrer"
																	className="text-sm underline"
																>
																	{person.name}
																</a>
																<span className="text-muted-foreground text-xs">
																	{person.title}
																</span>
																{[person.location, person.employer]
																	.filter(Boolean)
																	.join(" · ") ? (
																	<span className="text-muted-foreground text-xs">
																		{[person.location, person.employer]
																			.filter(Boolean)
																			.join(" · ")}
																	</span>
																) : null}
																{person.email ? (
																	<a
																		href={`mailto:${person.email}`}
																		className="text-xs underline"
																	>
																		{person.email}
																	</a>
																) : null}
																{person.phone ? (
																	<a
																		href={`tel:${person.phone}`}
																		className="text-xs underline"
																	>
																		{person.phone}
																	</a>
																) : null}
																{person.enriched &&
																!person.email &&
																!person.phone ? (
																	<span className="text-muted-foreground text-xs">
																		Unifers found no email or phone.
																	</span>
																) : null}
															</div>
															<Button
																variant="outline"
																size="sm"
																disabled={queue.isPending}
																onClick={() =>
																	queue.mutate({ person, hook: row.hook })
																}
															>
																Queue on LinkedIn
															</Button>
														</li>
													);
												})}
											</ul>
										)}
									</div>
									<div className="flex min-w-0 flex-col gap-1">
										<p className="text-muted-foreground text-xs">
											Opening line
										</p>
										<p className="text-sm">{row.hook}</p>
										<p className="text-muted-foreground text-xs">{row.why}</p>
										<div className="flex items-center gap-2 pt-1">
											<Badge variant={row.polished ? "secondary" : "outline"}>
												{row.polished ? "Model wording" : "Template"}
											</Badge>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => void copy(row.hook)}
											>
												Copy
											</Button>
										</div>
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function PastRuns({
	runs,
	labels,
	openRun,
	onOpen,
}: {
	runs: PartnerRun[];
	labels: { sectors: Labels; signals: Labels };
	openRun: string | null;
	onOpen: (run: string) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Past partner searches</CardTitle>
				<CardDescription>
					Newest first. A search repeated within 7 days reads its results from
					the cache and spends no credits.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{runs.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyTitle>No partner searches yet</EmptyTitle>
							<EmptyDescription>
								Start one with the form above.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<SimpleTable
						columns={[
							{ id: "name", header: "Search" },
							{ id: "status", header: "Status" },
							{ id: "searches", header: "Searches", align: "right" },
							{ id: "found", header: "Partners", align: "right" },
							{ id: "tokens", header: "Model tokens", align: "right" },
							{ id: "started", header: "Started" },
							{ id: "open", srLabel: "Open" },
						]}
					>
						{runs.map((run) => (
							<SimpleTableRow key={run.id}>
								<TableCell className="max-w-72 px-3">
									<p className="truncate">{run.name}</p>
									<p className="truncate text-muted-foreground text-xs">
										{run.countries.join(", ")} ·{" "}
										{listOf(run.sectors, labels.sectors)}
									</p>
								</TableCell>
								<TableCell className="px-3">
									{RUN_STATUS_LABELS[run.status]}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{run.searched} new · {run.cached} cached
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{run.found}
									{run.sizeUnknown + run.sizeTooBig > 0
										? ` · ${run.sizeUnknown + run.sizeTooBig} dropped by size`
										: ""}
								</TableCell>
								<TableCell className="px-3 text-right tabular-nums">
									{run.modelUsed ? COUNT.format(run.tokens) : "—"}
								</TableCell>
								<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
									<LocalDateTime date={run.startedAt} options={DATE_TIME} />
								</TableCell>
								<TableCell className="px-3 text-right">
									<Button
										variant="ghost"
										size="sm"
										disabled={run.status !== "done" || run.id === openRun}
										onClick={() => onOpen(run.id)}
									>
										{run.id === openRun ? "Open" : "View"}
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
