import { Bebas_Neue, Poppins } from "next/font/google";
import { Suspense } from "react";
import {
	AgentBuilderShell,
	AgentBuilderSidebarFallback,
} from "@/components/agent-builder/agent-builder-shell";
import { AgentBuilderSidebar } from "@/components/agent-builder/agent-builder-sidebar";
import styles from "@/components/agent-builder/chat-design.module.css";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

const display = Bebas_Neue({
	weight: "400",
	subsets: ["latin"],
	variable: "--font-dashboard-display",
});

const sans = Poppins({
	weight: ["400", "500", "600"],
	subsets: ["latin"],
	variable: "--font-dashboard-sans",
});

export default function AgentBuilderLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<AgentBuilderShell
				sidebar={
					<Suspense fallback={<AgentBuilderSidebarFallback />}>
						<PrefetchedAgentBuilderSidebar />
					</Suspense>
				}
			>
				{children}
			</AgentBuilderShell>
		</div>
	);
}

async function PrefetchedAgentBuilderSidebar() {
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const conversationsQuery = trpc.conversations.builderList.queryOptions();
	const agentsQuery = trpc.agents.list.queryOptions();

	const [conversations, agents] = await Promise.all([
		queryClient.fetchQuery(conversationsQuery),
		queryClient.fetchQuery(agentsQuery),
	]);
	const updatedAt = Math.min(
		queryClient.getQueryState(conversationsQuery.queryKey)?.dataUpdatedAt ?? 0,
		queryClient.getQueryState(agentsQuery.queryKey)?.dataUpdatedAt ?? 0,
	);

	return (
		<HydrateClient>
			<AgentBuilderSidebar
				className="hidden md:flex"
				initialData={{ conversations, agents, updatedAt }}
			/>
		</HydrateClient>
	);
}
