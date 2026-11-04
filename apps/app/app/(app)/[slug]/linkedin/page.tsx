import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { scraperViewerUrl } from "@/lib/linkedin-scraper/bridge";
import { requireSession } from "@/lib/session";
import { LinkedInOverview } from "./linkedin-overview";

export const metadata: Metadata = {
	title: "LinkedIn",
};

export default function LinkedInOverviewPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Overview />
		</Suspense>
	);
}

async function Overview() {
	await requireSession();
	return <LinkedInOverview viewerBaseUrl={scraperViewerUrl()} />;
}
