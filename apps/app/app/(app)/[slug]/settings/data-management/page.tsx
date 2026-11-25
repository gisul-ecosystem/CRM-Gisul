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
import { DataManagementView } from "./data-management-view";

export const metadata: Metadata = {
	title: "Data Management",
};

export default function DataManagementSettingsPage() {
	return (
		<PageShell>
			<PageShellContent>
				<Suspense fallback={<DataManagementFallback />}>
					<DataManagementView />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

function DataManagementFallback() {
	return (
		<div className="flex h-64 items-center justify-center">
			<Spinner className="size-6 text-[#5e3da8]" />
		</div>
	);
}
