import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { LeadGenerationOverview } from "./lead-generation-overview";

export const metadata: Metadata = {
	title: "Lead generation",
};

export default function LeadGenerationPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Overview />
		</Suspense>
	);
}

async function Overview() {
	await requireSession();
	return <LeadGenerationOverview />;
}
