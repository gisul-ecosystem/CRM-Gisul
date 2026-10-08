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
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = {
	title: "General",
};

export default function GeneralSettingsPage() {
	return (
		<PageShell>
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
	]);

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<WorkspaceForm />
			</div>
		</HydrateClient>
	);
}
