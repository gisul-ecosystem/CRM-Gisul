import type { Metadata } from "next";
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
import { DealsHeaderActions } from "./deals-header-actions";
import styles from "./deals-design.module.css";
import { dealsSearchParams } from "./deals-search-params";
import { DealsTable } from "./deals-table";

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

export const metadata: Metadata = {
	title: "Deals",
};

export default function DealsPage({
	searchParams,
}: PageProps<"/[slug]/deals">) {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="gap-4">
				<header className={styles.top}>
					<div className={styles.topText}>
						<h1 className={styles.title}>Deals</h1>
						<p className={styles.subtitle}>
							Track and manage opportunities across your products.
						</p>
					</div>
					<Suspense fallback={null}>
						<DealsHeaderActions />
					</Suspense>
				</header>

				<PageShellContent className="gap-0">
					<Suspense fallback={<PageShellLoading />}>
						<Deals searchParams={searchParams} />
					</Suspense>
				</PageShellContent>
			</PageShell>
		</div>
	);
}

async function Deals({
	searchParams,
}: Pick<PageProps<"/[slug]/deals">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		dealsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.deals.list.queryOptions(dealsSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.deals.trend.queryOptions()),
		queryClient.prefetchQuery(trpc.deals.pipelineByProduct.queryOptions()),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
		queryClient.prefetchQuery(trpc.companies.options.queryOptions({ q: "" })),
	]);

	return (
		<HydrateClient>
			<DealsTable />
		</HydrateClient>
	);
}
