"use client";

import { Badge } from "@crm/ui/components/badge";
import { useQuery } from "@tanstack/react-query";
import { usePipelineStatus } from "@/lib/leads-pipeline/use-status";
import { companiesApi, profilesApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys } from "@/lib/linkedin-scraper/cache";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { useScraperStatus } from "@/lib/linkedin-scraper/use-status";
import { COUNT } from "@/lib/outreach/format";

export function TabCount({ value }: { value: number | null | undefined }) {
	if (value === null || value === undefined) return null;
	return <Badge variant="secondary">{COUNT.format(value)}</Badge>;
}

export function WebsiteLeadsCount() {
	const status = usePipelineStatus();
	const profiles = status.data?.profiles;
	if (!profiles) return null;
	return (
		<TabCount
			value={profiles.reduce(
				(total, entry) =>
					total + (entry.summary.rows ?? entry.summary.companies),
				0,
			)}
		/>
	);
}

export function LinkedInProfilesCount() {
	const status = useScraperStatus();
	return <TabCount value={status.data?.totalProfiles} />;
}

export function FoundPostsCount() {
	const profiles = useQuery({
		queryKey: scraperKeys.profiles,
		queryFn: () => profilesApi.list(),
		refetchInterval: LINKEDIN_SCRAPER.refresh.listMs,
		retry: false,
	});
	return (
		<TabCount
			value={
				profiles.data?.profiles.filter((profile) => profile.sourcePost !== null)
					.length
			}
		/>
	);
}

export function LinkedInCompaniesCount() {
	const companies = useQuery({
		queryKey: [...scraperKeys.companies, "count"],
		queryFn: () =>
			companiesApi.list({ q: "", country: "", industry: "", page: 1 }, 1),
		refetchInterval: LINKEDIN_SCRAPER.refresh.listMs,
		retry: false,
	});
	return <TabCount value={companies.data?.total} />;
}
