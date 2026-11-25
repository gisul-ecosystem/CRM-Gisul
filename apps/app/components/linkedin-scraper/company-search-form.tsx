"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Skeleton } from "@crm/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { companiesApi, scrapeApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys, useScraperCache } from "@/lib/linkedin-scraper/cache";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";

type Option = { id: string; label: string };

function toggle(list: string[], id: string, on: boolean): string[] {
	return on ? [...new Set([...list, id])] : list.filter((item) => item !== id);
}

function OptionChecks({
	legend,
	description,
	options,
	selected,
	onChange,
}: {
	legend: string;
	description: string;
	options: Option[];
	selected: string[];
	onChange: (next: string[]) => void;
}) {
	const id = useId();
	return (
		<FieldSet>
			<FieldLegend variant="label">{legend}</FieldLegend>
			<FieldDescription>{description}</FieldDescription>
			<div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
				{options.map((option) => (
					<Field key={option.id} orientation="horizontal">
						<Checkbox
							id={`${id}-${option.id}`}
							checked={selected.includes(option.id)}
							onCheckedChange={(checked) =>
								onChange(toggle(selected, option.id, checked === true))
							}
						/>
						<FieldLabel htmlFor={`${id}-${option.id}`}>
							{option.label}
						</FieldLabel>
					</Field>
				))}
			</div>
		</FieldSet>
	);
}

export function CompanySearchForm({ disabled }: { disabled: boolean }) {
	const cache = useScraperCache();
	const keywordsId = useId();
	const maxId = useId();
	const rescrapeId = useId();
	const anyCountryId = useId();
	const { companies: defaults } = LINKEDIN_SCRAPER;

	const options = useQuery({
		queryKey: scraperKeys.companyOptions,
		queryFn: () => companiesApi.options(),
	});

	const [keywords, setKeywords] = useState("");
	const [industries, setIndustries] = useState<string[]>([
		...defaults.defaultIndustries,
	]);
	const [countries, setCountries] = useState<string[]>([
		...defaults.defaultCountries,
	]);
	const [anyCountry, setAnyCountry] = useState(false);
	const [maxCompanies, setMaxCompanies] = useState<number | null>(null);
	const [rescrape, setRescrape] = useState(false);

	const start = useMutation({
		mutationFn: () =>
			scrapeApi.companies({
				keywords: keywords.trim(),
				industries,
				countries: anyCountry ? [] : countries,
				anyCountry,
				maxCompanies: maxCompanies ?? options.data?.defaultMaxCompanies ?? 20,
				rescrape,
			}),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.scrape();
		},
		onError: (error) => toast.error(error.message),
	});

	if (options.isPending) return <Skeleton className="h-64 w-full rounded-lg" />;
	if (options.isError) {
		return <p className="text-destructive text-xs">{options.error.message}</p>;
	}

	const { data } = options;
	const left = Math.max(0, data.dailyRunLimit - data.runsToday);
	const ready =
		(anyCountry || countries.length > 0) &&
		(industries.length > 0 || keywords.trim() !== "");

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				start.mutate();
			}}
		>
			<FieldGroup>
				<OptionChecks
					legend="Industries"
					description="LinkedIn's own industry filter. Pick one or more."
					options={data.industries}
					selected={industries}
					onChange={setIndustries}
				/>
				<Field orientation="horizontal">
					<Checkbox
						id={anyCountryId}
						checked={anyCountry}
						onCheckedChange={(checked) => setAnyCountry(checked === true)}
					/>
					<FieldLabel htmlFor={anyCountryId}>
						Any country (worldwide, no headquarters check)
					</FieldLabel>
				</Field>
				{anyCountry ? null : (
					<OptionChecks
						legend="Headquarters country"
						description="LinkedIn's country filter. A company whose headquarters is elsewhere is skipped."
						options={data.countries}
						selected={countries}
						onChange={setCountries}
					/>
				)}
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor={keywordsId}>Keywords (optional)</FieldLabel>
						<Input
							id={keywordsId}
							maxLength={defaults.maxKeywordChars}
							value={keywords}
							placeholder="cloud training"
							onChange={(event) => setKeywords(event.target.value)}
						/>
						<FieldDescription>
							Narrows the industry search by words in the company name or
							description.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor={maxId}>How many companies</FieldLabel>
						<Input
							id={maxId}
							type="number"
							min={1}
							max={data.maxCompaniesCap}
							value={maxCompanies ?? data.defaultMaxCompanies}
							onChange={(event) => setMaxCompanies(Number(event.target.value))}
						/>
						<FieldDescription>
							At most {data.maxCompaniesCap}. Each company page takes 30 to 60
							seconds, for account safety.
						</FieldDescription>
					</Field>
				</div>
				<Field orientation="horizontal">
					<Checkbox
						id={rescrapeId}
						checked={rescrape}
						onCheckedChange={(checked) => setRescrape(checked === true)}
					/>
					<FieldLabel htmlFor={rescrapeId}>
						Read companies already saved again
					</FieldLabel>
				</Field>
			</FieldGroup>
			<p className="text-muted-foreground text-xs">
				{left} of {data.dailyRunLimit} company searches left today. Results go
				to LinkedIn → Companies.
			</p>
			<div>
				<Button
					type="submit"
					disabled={disabled || !ready || left === 0 || start.isPending}
				>
					Search companies
				</Button>
			</div>
		</form>
	);
}
