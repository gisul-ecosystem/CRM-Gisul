import type { Metadata } from "next";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { LeadSettingsView } from "./lead-settings-view";

export const metadata: Metadata = {
	title: "Lead Settings",
};

export default function LeadSettingsPage() {
	return (
		<PageShell>
			<PageShellContent>
				<LeadSettingsView />
			</PageShellContent>
		</PageShell>
	);
}
