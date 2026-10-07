import { Bebas_Neue, Poppins } from "next/font/google";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellLoading,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import styles from "./dashboard-design.module.css";
import { DashboardSummary } from "./dashboard-summary";
import {
	OverviewGreeting,
	OverviewGreetingFallback,
} from "./overview-greeting";
import {
	OverviewScopeToggle,
	OverviewScopeToggleFallback,
} from "./overview-scope";
import { loadOverviewSearchParams } from "./overview-search-params";

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

export default function OverviewPage({ searchParams }: PageProps<"/[slug]">) {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="gap-[18px]">
				<header className={styles.top}>
					<div className={styles.topText}>
						<Suspense fallback={<OverviewGreetingFallback />}>
							<Greeting />
						</Suspense>
					</div>
					<Suspense fallback={<OverviewScopeToggleFallback />}>
						<OverviewScopeToggle />
					</Suspense>
				</header>

				<PageShellContent className="gap-0 min-w-0">
					<Suspense fallback={<PageShellLoading />}>
						<Summary searchParams={searchParams} />
					</Suspense>
				</PageShellContent>
			</PageShell>
		</div>
	);
}

async function Greeting() {
	const session = await requireSession();
	return <OverviewGreeting name={session.user.name} />;
}

async function Summary({
	searchParams,
}: Pick<PageProps<"/[slug]">, "searchParams">) {
	const [, { scope, month }] = await Promise.all([
		requireSession(),
		loadOverviewSearchParams(searchParams),
	]);

	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		getServerTrpc().dashboard.summary.queryOptions({
			scope,
			...(month ? { month } : {}),
		}),
	);

	return (
		<HydrateClient>
			<DashboardSummary />
		</HydrateClient>
	);
}
