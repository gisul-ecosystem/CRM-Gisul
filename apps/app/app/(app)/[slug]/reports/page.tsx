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
import styles from "./reports-design.module.css";
import { ReportsPageClient } from "./reports-page-client";

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
	title: "Reports",
};

export default function ReportsPage() {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="min-h-0 gap-4">
				<PageShellContent className="min-h-0 gap-0">
					<Suspense fallback={<PageShellLoading />}>
						<Reports />
					</Suspense>
				</PageShellContent>
			</PageShell>
		</div>
	);
}

async function Reports() {
	await requireSession();
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.dashboard.report.queryOptions({
			range: "m",
			trendGrain: "monthly",
		}),
	);

	return (
		<HydrateClient>
			<ReportsPageClient />
		</HydrateClient>
	);
}
