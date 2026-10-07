import { Skeleton } from "@crm/ui/components/skeleton";
import styles from "./chat-design.module.css";

export function AgentBuilderHomeFallback() {
	return (
		<main className={styles.home} aria-busy="true">
			<div className={styles.homeInner}>
				<div className={styles.hero} aria-hidden="true">
					<Skeleton className="h-6 w-28 rounded-full" />
					<Skeleton className="h-10 w-72 max-w-full" />
					<Skeleton className="h-4 w-96 max-w-full" />
				</div>
				<div className={styles.composerCard} aria-hidden="true">
					<Skeleton className="h-24 w-full rounded-lg" />
				</div>
			</div>
			<span role="status" className="sr-only">
				Opening chat…
			</span>
		</main>
	);
}

export function AgentBuilderChatFallback() {
	return (
		<main className={styles.chatBody} aria-busy="true">
			<header className={styles.chatHeader}>
				<Skeleton className="h-4 w-40 max-w-full" aria-hidden="true" />
			</header>
			<div className="min-h-0 flex-1 overflow-hidden">
				<div
					className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-5 sm:py-9"
					aria-hidden="true"
				>
					<Skeleton className="ms-auto h-16 w-2/3 max-w-[520px] rounded-lg" />
					<div className="flex max-w-[640px] flex-col gap-2">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-11/12" />
						<Skeleton className="h-4 w-8/12" />
					</div>
				</div>
			</div>
			<span role="status" className="sr-only">
				Opening chat…
			</span>
		</main>
	);
}
