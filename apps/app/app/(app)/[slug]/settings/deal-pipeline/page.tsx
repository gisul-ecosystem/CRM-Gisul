import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { DealPipelineView } from "./deal-pipeline-view";

export const metadata: Metadata = {
	title: "Deal Pipeline",
};

export default function DealPipelineSettingsPage() {
	return (
		<PageShell>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<DealPipeline />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function DealPipeline() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(
		trpc.deals.pipelineOverview.queryOptions(),
	);

	return (
		<HydrateClient>
			<DealPipelineView />
		</HydrateClient>
	);
}
