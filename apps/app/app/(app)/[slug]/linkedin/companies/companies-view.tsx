"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
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
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ScraperGate } from "@/components/linkedin-scraper/scraper-page";
import { LocalDateTime } from "@/components/local-date-time";
import {
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { companiesApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys } from "@/lib/linkedin-scraper/cache";
import type {
	CompanyListQuery,
	LinkedInCompany,
} from "@/lib/linkedin-scraper/schemas";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { DATE_ONLY } from "@/lib/outreach/format";
import { useDebounced } from "@/lib/outreach/use-debounced";

const ALL = "all";

export function CompaniesPanel() {
	return (
		<ScraperGate>
			<CompaniesBody />
		</ScraperGate>
	);
}

function websiteHref(website: string): string {
	return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function shortWebsite(website: string): string {
	return website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function CompaniesBody() {
	const [search, setSearch] = useState("");
	const [country, setCountry] = useState(ALL);
	const [industry, setIndustry] = useState(ALL);
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<LinkedInCompany | null>(null);
	const q = useDebounced(search, LINKEDIN_SCRAPER.searchDebounceMs).trim();
	const { pageSize } = LINKEDIN_SCRAPER.companies;

	const query: CompanyListQuery = {
		q,
		country: country === ALL ? "" : country,
		industry: industry === ALL ? "" : industry,
		page,
	};

	const companies = useQuery({
		queryKey: [...scraperKeys.companies, query],
		queryFn: () => companiesApi.list(query, pageSize),
		placeholderData: keepPreviousData,
		refetchInterval: LINKEDIN_SCRAPER.refresh.listMs,
	});

	const download = useMutation({
		mutationFn: () => companiesApi.download(),
		onSuccess: (filename) => toast.success(`Downloaded ${filename}.`),
		onError: (error) => toast.error(error.message),
	});

	if (companies.isPending) {
		return <Skeleton className="h-64 w-full rounded-lg" />;
	}
	if (companies.isError) {
		return (
			<p className="text-destructive text-xs">{companies.error.message}</p>
		);
	}

	const { data } = companies;
	const change = (apply: () => void) => {
		apply();
		setPage(1);
	};

	return (
		<div className="flex flex-col gap-4">
			<OutreachToolbar>
				<SearchBox
					value={search}
					onChange={(value) => change(() => setSearch(value))}
					placeholder="Search name, industry, city, specialty or website"
				/>
				<FilterSelect
					value={country}
					onChange={(value) => change(() => setCountry(value))}
					options={[
						{ value: ALL, label: "Every country" },
						...data.countries.map((name) => ({ value: name, label: name })),
					]}
					label="Country"
				/>
				<FilterSelect
					value={industry}
					onChange={(value) => change(() => setIndustry(value))}
					options={[
						{ value: ALL, label: "Every industry" },
						...data.industries.map((name) => ({ value: name, label: name })),
					]}
					label="Industry"
				/>
				<Button
					variant="outline"
					size="sm"
					disabled={download.isPending || data.total === 0}
					onClick={() => download.mutate()}
				>
					Download Excel
				</Button>
			</OutreachToolbar>

			{data.companies.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No companies yet</EmptyTitle>
						<EmptyDescription>
							Go to Search and scrape, open the Companies tab, pick industries
							and a country, and start a search.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "name", header: "Company" },
						{ id: "industry", header: "Industry" },
						{ id: "size", header: "Size" },
						{ id: "hq", header: "Headquarters" },
						{ id: "website", header: "Website" },
						{ id: "found", header: "Found" },
					]}
				>
					{data.companies.map((company) => (
						<SimpleTableRow
							key={company.slug}
							clickable
							onClick={() => setOpen(company)}
						>
							<TableCell className="max-w-64 px-3">
								<p className="truncate font-medium">{company.name}</p>
								{company.tagline ? (
									<p className="truncate text-muted-foreground text-xs">
										{company.tagline}
									</p>
								) : null}
							</TableCell>
							<TableCell className="max-w-48 truncate px-3 text-xs">
								{company.industry || "—"}
							</TableCell>
							<TableCell className="whitespace-nowrap px-3 text-xs">
								{company.companySize || "—"}
							</TableCell>
							<TableCell className="max-w-48 truncate px-3 text-xs">
								{company.headquarters || "—"}
							</TableCell>
							<TableCell className="max-w-48 truncate px-3 text-xs">
								{company.website ? (
									<a
										href={websiteHref(company.website)}
										target="_blank"
										rel="noreferrer noopener"
										className="underline-offset-2 hover:underline"
										onClick={(event) => event.stopPropagation()}
									>
										{shortWebsite(company.website)}
									</a>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="whitespace-nowrap px-3 text-muted-foreground text-xs">
								{company.foundAt ? (
									<LocalDateTime date={company.foundAt} options={DATE_ONLY} />
								) : (
									"—"
								)}
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			{data.total > pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(data.total / pageSize)}
					pageSize={pageSize}
					total={data.total}
					onPageChange={setPage}
					loading={companies.isFetching}
				/>
			) : null}

			<CompanyDialog company={open} onClose={() => setOpen(null)} />
		</div>
	);
}

function CompanyDialog({
	company,
	onClose,
}: {
	company: LinkedInCompany | null;
	onClose: () => void;
}) {
	if (!company) return null;
	const rows = [
		{ label: "Industry", value: company.industry },
		{ label: "Company size", value: company.companySize },
		{ label: "Employees on LinkedIn", value: company.employeesOnLinkedIn },
		{ label: "Headquarters", value: company.headquarters },
		{ label: "Country", value: company.country },
		{ label: "Founded", value: company.founded },
		{ label: "Type", value: company.companyType },
		{ label: "Phone", value: company.phone },
		{ label: "Followers", value: company.followers },
		{ label: "Specialties", value: company.specialties },
	].filter((row) => row.value);
	const searched = company.search
		? [
				company.search.keywords,
				...company.search.industries,
				...company.search.countries,
			]
				.filter(Boolean)
				.join(" · ")
		: "";

	return (
		<Dialog open onOpenChange={(next) => (next ? null : onClose())}>
			<DialogContent className="sm:max-w-(--container-sheet)">
				<DialogHeader>
					<DialogTitle>{company.name}</DialogTitle>
					<DialogDescription>
						{company.tagline || company.industry}
					</DialogDescription>
				</DialogHeader>
				<DialogBody>
					<div className="flex flex-col gap-4">
						<div className="flex flex-wrap gap-2">
							{company.website ? (
								<Button asChild variant="outline" size="sm">
									<a
										href={websiteHref(company.website)}
										target="_blank"
										rel="noreferrer noopener"
									>
										Website
									</a>
								</Button>
							) : null}
							{company.linkedinUrl ? (
								<Button asChild variant="outline" size="sm">
									<a
										href={company.linkedinUrl}
										target="_blank"
										rel="noreferrer noopener"
									>
										LinkedIn page
									</a>
								</Button>
							) : null}
						</div>
						<dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr]">
							{rows.map((row) => (
								<div key={row.label} className="contents">
									<dt className="text-muted-foreground text-xs">{row.label}</dt>
									<dd className="text-xs">{row.value}</dd>
								</div>
							))}
						</dl>
						{company.overview ? (
							<p className="whitespace-pre-line text-xs/relaxed">
								{company.overview}
							</p>
						) : null}
						{searched ? (
							<p className="text-muted-foreground text-xs">
								Found by: {searched}
							</p>
						) : null}
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
