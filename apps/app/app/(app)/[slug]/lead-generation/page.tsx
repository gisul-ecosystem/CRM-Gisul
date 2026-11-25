import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadHubPage } from "@/components/lead-hub/lead-hub-page";
import { PageShellFallback } from "@/components/page-shell";
import { LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";
import { scraperViewerUrl } from "@/lib/linkedin-scraper/bridge";
import { requireSession } from "@/lib/session";
import { LinkedInOverviewPanel } from "../linkedin/linkedin-overview";
import { PipelineOverviewPanel } from "./lead-generation-overview";

export const metadata: Metadata = {
	title: "Lead generation",
};

export default function LeadGenerationPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Overview />
		</Suspense>
	);
}

async function Overview() {
	await requireSession();
	const { views } = LEAD_HUB;
	return (
		<LeadHubPage
			title="Lead generation"
			tabs={[
				{
					value: views.overview.website,
					label: "Website pipeline",
					source: "website",
					description:
						"Finds companies and decision makers from public websites, checks their emails, and scores each lead. Start a run here.",
					content: <PipelineOverviewPanel />,
				},
				{
					value: views.overview.linkedin,
					label: "LinkedIn",
					source: "linkedin",
					description:
						"Your LinkedIn account, its browser, today's sending budget, and the AI that drafts each message.",
					content: <LinkedInOverviewPanel viewerBaseUrl={scraperViewerUrl()} />,
				},
			]}
		/>
	);
}
