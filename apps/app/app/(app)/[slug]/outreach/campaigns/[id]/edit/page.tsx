import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { CampaignWizardForId } from "../../wizard/campaign-wizard";

export const metadata: Metadata = {
	title: "Edit campaign",
};

export default function EditOutreachCampaignPage({
	params,
}: PageProps<"/[slug]/outreach/campaigns/[id]/edit">) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<EditCampaign params={params} />
		</Suspense>
	);
}

async function EditCampaign({
	params,
}: Pick<PageProps<"/[slug]/outreach/campaigns/[id]/edit">, "params">) {
	const [session, { id }] = await Promise.all([requireSession(), params]);
	return <CampaignWizardForId id={id} viewerEmail={session.user.email} />;
}
