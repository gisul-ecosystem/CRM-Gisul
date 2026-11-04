import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { OutreachOverview } from "./outreach-overview";

export const metadata: Metadata = {
	title: "Outreach",
};

export default function OutreachOverviewPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Overview />
		</Suspense>
	);
}

async function Overview() {
	await requireSession();
	return <OutreachOverview />;
}
