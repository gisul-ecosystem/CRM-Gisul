import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { membersSearchParams } from "./members-search-params";
import { UsersTeamsView } from "./users-teams-view";

export const metadata: Metadata = {
	title: "Users & Teams",
};

export default function MembersSettingsPage({
	searchParams,
}: PageProps<"/[slug]/settings/members">) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 md:p-8">
			<Suspense fallback={<PageShellLoading />}>
				<Members searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function Members({
	searchParams,
}: Pick<PageProps<"/[slug]/settings/members">, "searchParams">) {
	await requireSession();

	const values = await membersSearchParams.load(searchParams);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.workspace.get.queryOptions()),
		queryClient.prefetchQuery(
			trpc.workspace.members.queryOptions(membersSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.workspace.teams.queryOptions()),
		queryClient.prefetchQuery(trpc.workspace.roles.queryOptions()),
		queryClient.prefetchQuery(trpc.workspace.invitationSettings.queryOptions()),
	]);

	return (
		<HydrateClient>
			<UsersTeamsView />
		</HydrateClient>
	);
}
