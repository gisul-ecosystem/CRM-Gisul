import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { Spinner } from "@crm/ui/components/spinner";
import { IntegrationsView } from "./integrations-view";

export const metadata: Metadata = {
	title: "Integrations",
};

export default function ConnectionsSettingsPage() {
	return (
		<PageShell>
			<PageShellContent>
				<Suspense fallback={<IntegrationsFallback />}>
					<IntegrationsView />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

function IntegrationsFallback() {
	return (
		<div className="flex h-64 items-center justify-center">
			<Spinner className="size-6 text-[#5e3da8]" />
		</div>
	);
}
