"use client";

import Add from "@carbon/icons-react/es/Add";
import SidePanelOpen from "@carbon/icons-react/es/SidePanelOpen";
import { Icon } from "@crm/ui/components/icon";
import { Skeleton } from "@crm/ui/components/skeleton";
import Link from "next/link";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import styles from "./chat-design.module.css";
import {
	ChatSidebarProvider,
	useChatSidebar,
} from "./chat-sidebar-context";

export function AgentBuilderShell({
	children,
	sidebar,
}: {
	children: React.ReactNode;
	sidebar: React.ReactNode;
}) {
	return (
		<ChatSidebarProvider>
			<ShellFrame sidebar={sidebar}>{children}</ShellFrame>
		</ChatSidebarProvider>
	);
}

function ShellFrame({
	children,
	sidebar,
}: {
	children: React.ReactNode;
	sidebar: React.ReactNode;
}) {
	const chatSidebar = useChatSidebar();
	const open = chatSidebar?.open ?? true;

	return (
		<div
			className={styles.frame}
			data-sidebar={open ? "open" : "closed"}
		>
			{open ? sidebar : <CollapsedChatRail />}
			<div className={styles.main}>{children}</div>
		</div>
	);
}

function CollapsedChatRail() {
	const workspaceUrl = useWorkspaceUrl();
	const chatSidebar = useChatSidebar();

	return (
		<aside className={styles.sidebarRail} aria-label="Collapsed chat sidebar">
			<button
				type="button"
				className={styles.railButton}
				aria-label="Open chat sidebar"
				aria-expanded={false}
				onClick={() => chatSidebar?.expand()}
			>
				<Icon icon={SidePanelOpen} />
			</button>
			<Link
				href={workspaceUrl("/chat")}
				aria-label="New agent chat"
				className={styles.railButton}
			>
				<Icon icon={Add} />
			</Link>
		</aside>
	);
}

export function AgentBuilderSidebarFallback() {
	return (
		<aside className={styles.sidebarFallback} aria-busy="true">
			<div className={styles.sidebarHead}>
				<span className={styles.sidebarTitle}>Chats</span>
			</div>
			<div className={styles.nav} aria-hidden="true">
				<div className="mt-3 space-y-2 px-2">
					<Skeleton className="h-2.5 w-16" />
					<Skeleton className="h-7 w-full" />
					<Skeleton className="h-7 w-full" />
					<Skeleton className="h-7 w-full" />
				</div>
			</div>
			<span role="status" className="sr-only">
				Loading agent navigation…
			</span>
		</aside>
	);
}
