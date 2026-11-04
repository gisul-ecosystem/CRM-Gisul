import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { ScrapeView } from "./scrape-view";

export const metadata: Metadata = {
	title: "Search and scrape",
};

export default function LinkedInScrapePage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Scrape />
		</Suspense>
	);
}

async function Scrape() {
	await requireSession();
	return <ScrapeView />;
}
