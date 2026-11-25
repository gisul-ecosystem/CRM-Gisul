import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { AudiencesView } from "./audiences-view";

export const metadata: Metadata = {
	title: "Audiences",
};

export default function OutreachAudiencesPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Audiences />
		</Suspense>
	);
}

async function Audiences() {
	await requireSession();
	return <AudiencesView />;
}
