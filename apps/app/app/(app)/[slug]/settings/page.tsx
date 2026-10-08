import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellLoading,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { AgentModel } from "./agent-model";
import { ArchiveRetention } from "./archive-retention";
import { ResearchKey } from "./research-key";
import styles from "./settings-design.module.css";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = {
	title: "General",
};

export default function GeneralSettingsPage() {
	return (
		<PageShell className={styles.page}>
			<header className={styles.top}>
				<div className={styles.topText}>
					<h1 className={styles.title}>General</h1>
					<p className={styles.subtitle}>
						Who you are, and the model the research agent thinks with.
					</p>
				</div>
			</header>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Settings />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Settings() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.workspace.get.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.agentModel.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.modelCatalog.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.researchKey.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.archiveRetention.queryOptions()),
	]);

	return (
		<HydrateClient>
			<div className={styles.stack}>
				<WorkspaceForm />
				<ResearchKey />
				<ArchiveRetention />
				<AgentModel />
			</div>
		</HydrateClient>
	);
}
