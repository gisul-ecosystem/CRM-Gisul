import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadHubPage } from "@/components/lead-hub/lead-hub-page";
import { PageShellFallback } from "@/components/page-shell";
import { LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";
import { pipelineViewerSrc } from "@/lib/leads-pipeline/bridge";
import { scraperViewerUrl } from "@/lib/linkedin-scraper/bridge";
import { requireSession } from "@/lib/session";
import { ScrapePanel } from "../../linkedin/scrape/scrape-view";
import { CustomSearchPanel } from "../search/custom-search-view";

export const metadata: Metadata = {
	title: "Find leads",
};

export default function FindLeadsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<FindLeads />
		</Suspense>
	);
}

async function FindLeads() {
	await requireSession();
	const { views } = LEAD_HUB;
	return (
		<LeadHubPage
			title="Find leads"
			tabs={[
				{
					value: views.find.website,
					label: "Website search",
					source: "website",
					description:
						"Describe the companies you want. The pipeline searches the web, reads each website, finds people and emails, and scores them.",
					content: <CustomSearchPanel viewerSrc={pipelineViewerSrc()} />,
				},
				{
					value: views.find.linkedin,
					label: "LinkedIn search",
					source: "linkedin",
					description:
						"Search LinkedIn for people, posts or companies, or import a file of profile links. Each person gets an AI draft or your template.",
					content: <ScrapePanel viewerBaseUrl={scraperViewerUrl()} />,
				},
			]}
		/>
	);
}
