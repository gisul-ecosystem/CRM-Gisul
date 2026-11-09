import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = {
	title: "Lead generation settings",
};

export default function LeadGenerationSettingsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Settings />
		</Suspense>
	);
}

async function Settings() {
	await requireSession();
	return <SettingsView />;
}
