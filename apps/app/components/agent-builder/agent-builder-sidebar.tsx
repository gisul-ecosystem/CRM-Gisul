"use client";

import Add from "@carbon/icons-react/es/Add";
import Bot from "@carbon/icons-react/es/Bot";
import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import CircleFilled from "@carbon/icons-react/es/CircleFilled";
import Renew from "@carbon/icons-react/es/Renew";
import SidePanelClose from "@carbon/icons-react/es/SidePanelClose";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ChatDateGroup, chatDateGroup } from "@/lib/chat-date-group";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useHydrated } from "@/lib/use-hydrated";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import styles from "./chat-design.module.css";
import { useChatSidebar } from "./chat-sidebar-context";
import { DeleteChatAction } from "./delete-chat-action";

type Conversation = RouterOutputs["conversations"]["builderList"][number];
type TeamAgent = RouterOutputs["agents"]["list"][number];
type SidebarData = {
	conversations: Conversation[];
	agents: TeamAgent[];
	updatedAt: number;
};

export function AgentBuilderSidebar({
	className,
	onNavigate,
	initialData,
}: {
	className?: string;
	onNavigate?: () => void;
	initialData?: SidebarData;
}) {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const hydrated = useHydrated();
	const conversations = useQuery({
		...trpc.conversations.builderList.queryOptions(),
		initialData: initialData?.conversations,
		initialDataUpdatedAt: initialData?.updatedAt,
		refetchInterval: (query) =>
			query.state.data?.some((conversation) => conversation.state === "working")
				? 2500
				: 30_000,
	});
	const agents = useQuery({
		...trpc.agents.list.queryOptions(),
		initialData: initialData?.agents,
		initialDataUpdatedAt: initialData?.updatedAt,
		refetchInterval: 60_000,
	});
	const markRead = useMutation(
		trpc.conversations.markRead.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.conversations.builderList.pathKey(),
				}),
		}),
	);

	const showData = Boolean(initialData) || hydrated;
	const groupNow =
		initialData && !hydrated
			? initialData.updatedAt
			: conversations.dataUpdatedAt;
	const groups = groupConversations(
		showData ? (conversations.data ?? []) : [],
		showData ? groupNow : 0,
	);
	const teamAgents = showData ? (agents.data ?? []) : [];
	const chatSidebar = useChatSidebar();

	return (
		<aside className={cn(styles.sidebar, className)}>
			<div className={styles.sidebarHead}>
				<span className={styles.sidebarTitle}>Chats</span>
				<div className={styles.sidebarActions}>
					<Link
						href={workspaceUrl("/chat")}
						aria-label="New agent chat"
						onClick={onNavigate}
						className={styles.newChat}
					>
						<Icon icon={Add} />
					</Link>
					{chatSidebar ? (
						<button
							type="button"
							className={styles.collapseChat}
							aria-label="Close chat sidebar"
							aria-expanded={chatSidebar.open}
							onClick={chatSidebar.collapse}
						>
							<Icon icon={SidePanelClose} />
						</button>
					) : null}
				</div>
			</div>

			<nav aria-label="Agent chats" className={styles.nav}>
				{groups.map((group) => (
					<div key={group.label}>
						<div className={styles.groupLabel}>{group.label}</div>
						{group.items.map((conversation) => {
							const href = workspaceUrl(`/chat/${conversation.id}`);
							const active = pathname === href;
							const title = conversation.title ?? "Untitled chat";
							return (
								<div
									key={conversation.id}
									className={`group ${styles.chatLink}`}
								>
									<Link
										href={href}
										aria-current={active ? "page" : undefined}
										onClick={() => {
											if (conversation.unread) {
												markRead.mutate({ id: conversation.id });
											}
											onNavigate?.();
										}}
										className={cn(
											styles.chatAnchor,
											active && styles.chatActive,
											!active &&
												conversation.state === "idle" &&
												styles.chatIdle,
										)}
									>
										<ConversationState state={conversation.state} />
										<span className={styles.chatTitle}>{title}</span>
									</Link>
									<DeleteChatAction
										conversationId={conversation.id}
										title={title}
										trigger="close"
										returnToChatList={active}
										onDeleted={active ? onNavigate : undefined}
										className="absolute right-1 opacity-100 transition-opacity duration-150 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:translate-x-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:translate-x-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100 motion-safe:transition-[opacity,translate] motion-reduce:translate-x-0"
									/>
								</div>
							);
						})}
					</div>
				))}

				{groups.length === 0 ? (
					<p className={styles.emptyChats}>No chats in the last 7 days.</p>
				) : null}

				<TeamAgents
					agents={teamAgents}
					pathname={pathname}
					onNavigate={onNavigate}
				/>
			</nav>
		</aside>
	);
}

function TeamAgents({
	agents,
	pathname,
	onNavigate,
}: {
	agents: TeamAgent[];
	pathname: string;
	onNavigate?: () => void;
}) {
	const workspaceUrl = useWorkspaceUrl();

	return (
		<div className={styles.teamBlock}>
			<Link
				href={workspaceUrl("/agents")}
				transitionTypes={["nav-lateral"]}
				onClick={onNavigate}
				className={styles.teamHead}
			>
				<span className="min-w-0 flex-1">Team agents</span>
				<span className={styles.teamCount}>{agents.length}</span>
			</Link>
			{agents.map((agent) => {
				const href = workspaceUrl(`/agents/${agent.id}`);
				const active = pathname === href;
				return (
					<Link
						key={agent.id}
						href={href}
						aria-current={active ? "page" : undefined}
						onClick={onNavigate}
						className={cn(styles.agentLink, active && styles.agentActive)}
					>
						<span className="flex size-5 shrink-0 items-center justify-center">
							<Icon icon={Bot} className="size-3.5" />
						</span>
						<span className="min-w-0 flex-1 truncate">{agent.name}</span>
					</Link>
				);
			})}
		</div>
	);
}

function ConversationState({ state }: { state: Conversation["state"] }) {
	if (state === "working") {
		return (
			<span className={styles.stateIcon}>
				<Icon icon={Renew} className="size-3.5 animate-spin" motion="none" />
			</span>
		);
	}

	if (state === "unread") {
		return (
			<span className={`${styles.stateIcon} ${styles.stateActive}`}>
				<Icon icon={CircleFilled} className="size-3.5" motion="none" />
			</span>
		);
	}

	if (state === "deployed") {
		return (
			<span className={`${styles.stateIcon} ${styles.stateActive}`}>
				<Icon icon={CheckmarkFilled} className="size-3.5" motion="none" />
			</span>
		);
	}

	return null;
}

function groupConversations(conversations: Conversation[], now: number) {
	if (!now) return [];

	const labels: ChatDateGroup[] = ["Today", "Yesterday", "Last 7 days"];
	const items = new Map<ChatDateGroup, Conversation[]>(
		labels.map((label) => [label, []]),
	);

	for (const conversation of conversations) {
		const label = chatDateGroup(conversation.lastMessageAt, now);
		if (label) items.get(label)?.push(conversation);
	}

	return labels
		.map((label) => ({ label, items: items.get(label) ?? [] }))
		.filter((group) => group.items.length > 0);
}
