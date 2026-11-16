import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { CompaniesView } from "./companies-view";

export const metadata: Metadata = {
	title: "LinkedIn companies",
};

export default function LinkedInCompaniesPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Companies />
		</Suspense>
	);
}

async function Companies() {
	await requireSession();
	return <CompaniesView />;
}
