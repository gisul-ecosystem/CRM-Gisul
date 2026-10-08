import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ProductsSettings } from "./products-settings";

export const metadata: Metadata = {
	title: "Products",
};

export default function ProductsSettingsPage() {
	return (
		<PageShell>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Products />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Products() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.products.list.queryOptions({
				q: "",
				status: "all",
				sort: "position",
			}),
		),
		queryClient.prefetchQuery(trpc.products.display.queryOptions()),
		queryClient.prefetchQuery(trpc.products.meta.queryOptions()),
	]);

	return (
		<HydrateClient>
			<ProductsSettings />
		</HydrateClient>
	);
}
