import type { Metadata } from "next";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { ActivitySettingsView } from "./activity-settings-view";

export const metadata: Metadata = {
	title: "Activity Settings",
};

export default function ActivitySettingsPage() {
	return (
		<PageShell>
			<PageShellContent>
				<ActivitySettingsView />
			</PageShellContent>
		</PageShell>
	);
}
