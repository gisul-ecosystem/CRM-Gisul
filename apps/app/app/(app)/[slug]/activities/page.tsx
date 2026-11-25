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
import { ActivitiesPageClient } from "./activities-page-client";
import styles from "./activities-design.module.css";

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
	title: "Activities",
};

export default function ActivitiesPage() {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="min-h-0 gap-4">
				<PageShellContent className="min-h-0 gap-0">
					<Suspense fallback={<PageShellLoading />}>
						<ActivitiesContent />
					</Suspense>
				</PageShellContent>
			</PageShell>
		</div>
	);
}

async function ActivitiesContent() {
	await requireSession();
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	try {
		await queryClient.prefetchQuery(
			trpc.activities.list.queryOptions({ limit: 200 }),
		);
	} catch {
		// Fallback gracefully on cold boot
	}

	return (
		<HydrateClient>
			<ActivitiesPageClient />
		</HydrateClient>
	);
}


