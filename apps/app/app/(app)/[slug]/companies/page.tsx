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
import { contactsSearchParams } from "../contacts/contacts-search-params";
import { companiesSearchParams } from "./companies-search-params";
import { CustomersPageClient } from "./customers-page-client";
import styles from "./customers-design.module.css";

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
	title: "Customers",
};

export default function CompaniesPage({
	searchParams,
}: PageProps<"/[slug]/companies">) {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="min-h-0 gap-4">
				<PageShellContent className="min-h-0 gap-0">
					<Suspense fallback={<PageShellLoading />}>
						<Customers searchParams={searchParams} />
					</Suspense>
				</PageShellContent>
			</PageShell>
		</div>
	);
}

async function Customers({
	searchParams,
}: Pick<PageProps<"/[slug]/companies">, "searchParams">) {
	const [, companyValues, contactValues] = await Promise.all([
		requireSession(),
		companiesSearchParams.load(searchParams),
		contactsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.companies.list.queryOptions(
				companiesSearchParams.toInput(companyValues),
			),
		),
		queryClient.prefetchQuery(
			trpc.contacts.list.queryOptions(
				contactsSearchParams.toInput(contactValues),
			),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
		queryClient.prefetchQuery(trpc.users.me.queryOptions()),
	]);

	return (
		<HydrateClient>
			<CustomersPageClient />
		</HydrateClient>
	);
}
