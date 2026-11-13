import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { pipelineViewerSrc } from "@/lib/leads-pipeline/bridge";
import { requireSession } from "@/lib/session";
import { CustomSearchView } from "./custom-search-view";

export const metadata: Metadata = {
	title: "Custom search",
};

export default function CustomSearchPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<CustomSearch />
		</Suspense>
	);
}

async function CustomSearch() {
	await requireSession();
	return <CustomSearchView viewerSrc={pipelineViewerSrc()} />;
}
