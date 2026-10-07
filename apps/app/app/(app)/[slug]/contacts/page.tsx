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
import { contactsSearchParams } from "./contacts-search-params";
import { ContactsTable } from "./contacts-table";
import { LeadsHeaderActions } from "./leads-header-actions";
import styles from "./leads-design.module.css";

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
	title: "Leads",
};

export default function ContactsPage({
	searchParams,
}: PageProps<"/[slug]/contacts">) {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="min-h-0 gap-4">
				<header className={styles.top}>
					<div className={styles.topText}>
						<h1 className={styles.title}>Leads</h1>
						<p className={styles.subtitle}>
							Manage and convert potential customers across all products.
						</p>
					</div>
					<LeadsHeaderActions />
				</header>

				<PageShellContent className="min-h-0 gap-0">
					<Suspense fallback={<PageShellLoading />}>
						<Contacts searchParams={searchParams} />
					</Suspense>
				</PageShellContent>
			</PageShell>
		</div>
	);
}

async function Contacts({
	searchParams,
}: Pick<PageProps<"/[slug]/contacts">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		contactsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.contacts.list.queryOptions(contactsSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
		queryClient.prefetchQuery(trpc.companies.options.queryOptions({ q: "" })),
	]);

	return (
		<HydrateClient>
			<ContactsTable />
		</HydrateClient>
	);
}
