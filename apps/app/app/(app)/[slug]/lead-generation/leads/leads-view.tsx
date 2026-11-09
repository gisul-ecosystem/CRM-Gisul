"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LeadSheet } from "@/components/leads-pipeline/lead-sheet";
import { PipelinePage } from "@/components/leads-pipeline/pipeline-page";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { leadsApi } from "@/lib/leads-pipeline/api";
import { pipelineKeys } from "@/lib/leads-pipeline/cache";
import {
	intentTone,
	segmentLabel,
	segmentList,
	verifiedTone,
} from "@/lib/leads-pipeline/labels";
import { LEADS_PIPELINE } from "@/lib/leads-pipeline/pipeline-config";
import {
	LEAD_INTENTS,
	type Lead,
	type LeadFilters,
	type ProfileStatus,
} from "@/lib/leads-pipeline/schemas";
import { useDebounced } from "@/lib/outreach/use-debounced";

const NO_FILTERS: LeadFilters = {
	q: "",
	ready: false,
	hasEmail: false,
	intent: null,
	segment: null,
	country: null,
	latest: false,
	perCompany: false,
};

const INTENT_OPTIONS = [
	{ value: ALL, label: "Every intent" },
	...LEAD_INTENTS.map((intent) => ({
		value: intent,
		label: `${segmentLabel(intent)} intent`,
	})),
];

type Toggle = "ready" | "hasEmail" | "latest" | "perCompany";

const TOGGLES: readonly { key: Toggle; label: string }[] = [
	{ key: "ready", label: "Ready only" },
	{ key: "hasEmail", label: "Has email" },
	{ key: "latest", label: "From the last run" },
	{ key: "perCompany", label: "One per company" },
];

export function LeadsView() {
	return (
		<PipelinePage
			title="Leads"
			description="Every company and decision maker the pipeline found, best score first."
		>
			{(profile) => <LeadsBody key={profile.profile} status={profile} />}
		</PipelinePage>
	);
}

function LeadsBody({ status }: { status: ProfileStatus }) {
	const toggleId = useId();
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<LeadFilters>(NO_FILTERS);
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<Lead | null>(null);
	const q = useDebounced(search, LEADS_PIPELINE.searchDebounceMs);
	const applied = { ...filters, q };
	const { pageSize } = LEADS_PIPELINE;

	const leads = useQuery({
		queryKey: pipelineKeys.leads(status.profile, applied, page),
		queryFn: () => leadsApi.list(status.profile, applied, page, pageSize),
		placeholderData: keepPreviousData,
		refetchInterval: LEADS_PIPELINE.refresh.listMs,
	});

	const download = useMutation({
		mutationFn: () => leadsApi.download(status.profile, applied),
		onSuccess: (filename) => toast.success(`Downloaded ${filename}.`),
		onError: (error) => toast.error(error.message),
	});

	const change = (next: Partial<LeadFilters>) => {
		setFilters((current) => ({ ...current, ...next }));
		setPage(1);
	};

	const segmentOptions = [
		{ value: ALL, label: "Every segment" },
		...status.segments.map((segment) => ({
			value: segment,
			label: segmentLabel(segment),
		})),
	];
	const countryOptions = [
		{ value: ALL, label: "Every country" },
		...status.countries.map((country) => ({ value: country, label: country })),
	];

	const rows = leads.data?.rows ?? [];
	const total = leads.data?.total ?? 0;

	return (
		<div className="flex flex-col gap-4">
			<OutreachToolbar>
				<SearchBox
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
					placeholder="Search company, person, title or email"
				/>
				<FilterSelect
					value={filters.intent ?? ALL}
					onChange={(value) =>
						change({
							intent: LEAD_INTENTS.find((intent) => intent === value) ?? null,
						})
					}
					options={INTENT_OPTIONS}
					label="Intent"
				/>
				<FilterSelect
					value={filters.segment ?? ALL}
					onChange={(value) =>
						change({ segment: value === ALL ? null : value })
					}
					options={segmentOptions}
					label="Segment"
				/>
				<FilterSelect
					value={filters.country ?? ALL}
					onChange={(value) =>
						change({ country: value === ALL ? null : value })
					}
					options={countryOptions}
					label="Country"
				/>
				<Button
					variant="outline"
					size="sm"
					disabled={download.isPending || total === 0}
					onClick={() => download.mutate()}
				>
					Download Excel
				</Button>
			</OutreachToolbar>

			<div className="flex flex-wrap gap-4">
				{TOGGLES.map((toggle) => (
					<Field key={toggle.key} orientation="horizontal" className="w-auto">
						<Checkbox
							id={`${toggleId}-${toggle.key}`}
							checked={filters[toggle.key]}
							onCheckedChange={(checked) =>
								change({ [toggle.key]: checked === true })
							}
						/>
						<FieldLabel htmlFor={`${toggleId}-${toggle.key}`}>
							{toggle.label}
						</FieldLabel>
					</Field>
				))}
			</div>

			{leads.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : leads.isError ? (
				<p className="text-destructive text-xs">{leads.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{status.summary.companies === 0 ? "No leads yet" : "No match"}
						</EmptyTitle>
						<EmptyDescription>
							{status.summary.companies === 0
								? "Start a run on the Lead generation overview. Leads appear here when a round finishes."
								: "Change the search or the filters."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "company", header: "Company" },
						{ id: "person", header: "Person" },
						{ id: "email", header: "Email" },
						{ id: "segment", header: "Segment" },
						{ id: "intent", header: "Intent" },
						{ id: "score", header: "Score", align: "right" },
					]}
				>
					{rows.map((row) => (
						<SimpleTableRow
							key={`${row.domain}|${row.full_name}|${row.email}`}
							clickable
							onClick={() => setOpen(row)}
						>
							<TableCell className="max-w-56 px-3">
								<p className="truncate">{row.company || row.domain}</p>
								<p className="truncate text-muted-foreground text-xs">
									{[row.domain, row.country].filter(Boolean).join(" · ")}
								</p>
							</TableCell>
							<TableCell className="max-w-56 px-3">
								<p className="truncate">{row.full_name || "—"}</p>
								<p className="truncate text-muted-foreground text-xs">
									{row.title}
								</p>
							</TableCell>
							<TableCell className="max-w-64 px-3">
								{row.email ? (
									<StatusIndicator
										tone={verifiedTone(row.verified_status)}
										label={row.email}
										size="sm"
									/>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="max-w-48 truncate px-3">
								{segmentList(row.segment) || "—"}
							</TableCell>
							<TableCell className="px-3">
								{row.intent ? (
									<StatusIndicator
										tone={intentTone(row.intent)}
										label={segmentLabel(row.intent)}
										size="sm"
									/>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="px-3 text-right tabular-nums">
								{row.score || "—"}
								{row.ready === "yes" ? " · ready" : ""}
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			{total > pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(total / pageSize)}
					pageSize={pageSize}
					total={total}
					onPageChange={setPage}
					loading={leads.isFetching}
				/>
			) : null}

			<LeadSheet lead={open} onClose={() => setOpen(null)} />
		</div>
	);
}
