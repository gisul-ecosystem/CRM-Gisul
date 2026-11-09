import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { LeadsView } from "./leads-view";

export const metadata: Metadata = {
	title: "Leads",
};

export default function LeadsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Leads />
		</Suspense>
	);
}

async function Leads() {
	await requireSession();
	return <LeadsView />;
}
