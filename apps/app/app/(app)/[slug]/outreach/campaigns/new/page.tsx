import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { CampaignWizardPage } from "../wizard/campaign-wizard";

export const metadata: Metadata = {
	title: "New campaign",
};

export default function NewOutreachCampaignPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<NewCampaign />
		</Suspense>
	);
}

async function NewCampaign() {
	const session = await requireSession();
	return <CampaignWizardPage viewerEmail={session.user.email} />;
}
