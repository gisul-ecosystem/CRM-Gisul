import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { SentView } from "./sent-view";

export const metadata: Metadata = {
	title: "LinkedIn sent",
};

export default function LinkedInSentPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Sent />
		</Suspense>
	);
}

async function Sent() {
	await requireSession();
	return <SentView />;
}
