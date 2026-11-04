import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { CampaignsView } from "./campaigns-view";

export const metadata: Metadata = {
	title: "Campaigns",
};

export default function OutreachCampaignsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Campaigns />
		</Suspense>
	);
}

async function Campaigns() {
	await requireSession();
	return <CampaignsView />;
}
