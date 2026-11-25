"use client";

import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import Chat from "@carbon/icons-react/es/Chat";
import { Icon } from "@crm/ui/components/icon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AgentComposer, type BuilderComposerPrompt } from "./agent-composer";
import styles from "./chat-design.module.css";

const SUGGESTIONS = [
	"Brief every deal owner before a renewal call",
	"Flag deals with no activity for 14 days",
	"Hand new customers from Sales to Onboarding",
];

export function AgentBuilderHome({ name }: { name: string }) {
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [initialPrompt, setInitialPrompt] = useState("");
	const create = useMutation(
		trpc.conversations.createBuilder.mutationOptions({
			onSuccess: async ({ id }) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.conversations.builderList.pathKey(),
				});
				router.push(workspaceUrl(`/chat/${id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = async (
		prompt: BuilderComposerPrompt,
		clientRequestId: string,
	) => {
		await create.mutateAsync({
			...prompt,
			clientRequestId,
		});
	};

	return (
		<main className={styles.home}>
			<div className={styles.homeInner}>
				<div className={styles.hero}>
					<span className={styles.eyebrow}>
						<Icon icon={Chat} />
						Private chat
					</span>
					<h1 className={styles.title}>
						What can I help with, {firstName(name)}?
					</h1>
					<p className={styles.subtitle}>
						Ask about your CRM, tag a record or integration, or describe an
						agent to automate a task.
					</p>
				</div>

				<div className={styles.composerCard}>
					<AgentComposer
						key={initialPrompt}
						mode="home"
						initialPrompt={initialPrompt}
						onSubmit={submit}
					/>
					<p className={styles.composerNote}>
						Chats and agent drafts stay private to you. Deploying an agent makes
						it available to the whole team.
					</p>
				</div>

				<div className={styles.suggestions}>
					<p className={styles.suggestionsLabel}>Suggested agents</p>
					{SUGGESTIONS.map((suggestion) => (
						<button
							key={suggestion}
							type="button"
							onClick={() => setInitialPrompt(`/Create agent ${suggestion}`)}
							className={styles.suggestion}
						>
							<span className={styles.suggestionText}>{suggestion}</span>
							<span className={styles.suggestionIcon}>
								<Icon icon={ArrowRight} />
							</span>
						</button>
					))}
				</div>
			</div>
		</main>
	);
}

function firstName(name: string): string {
	return name.trim().split(/\s+/)[0] || "there";
}
