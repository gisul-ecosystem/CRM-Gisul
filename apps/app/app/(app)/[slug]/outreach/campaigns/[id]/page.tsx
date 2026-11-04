import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { CampaignDetail } from "./campaign-detail";

export const metadata: Metadata = {
	title: "Campaign",
};

export default function OutreachCampaignPage({
	params,
}: PageProps<"/[slug]/outreach/campaigns/[id]">) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Campaign params={params} />
		</Suspense>
	);
}

async function Campaign({
	params,
}: Pick<PageProps<"/[slug]/outreach/campaigns/[id]">, "params">) {
	const [session, { id }] = await Promise.all([requireSession(), params]);
	return <CampaignDetail id={id} viewerEmail={session.user.email} />;
}
