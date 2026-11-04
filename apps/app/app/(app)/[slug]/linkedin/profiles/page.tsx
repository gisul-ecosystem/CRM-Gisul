import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { ProfilesView } from "./profiles-view";

export const metadata: Metadata = {
	title: "LinkedIn profiles",
};

export default function LinkedInProfilesPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Profiles />
		</Suspense>
	);
}

async function Profiles() {
	await requireSession();
	return <ProfilesView />;
}
