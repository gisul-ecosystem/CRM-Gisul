import type { Metadata } from "next";
import { Bebas_Neue, Poppins } from "next/font/google";
import {
	PageShell,
	PageShellContent,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { ActivitiesPageClient } from "./activities-page-client";
import styles from "./activities-design.module.css";

const display = Bebas_Neue({
	weight: "400",
	subsets: ["latin"],
	variable: "--font-dashboard-display",
});

const sans = Poppins({
	weight: ["400", "500", "600"],
	subsets: ["latin"],
	variable: "--font-dashboard-sans",
});

export const metadata: Metadata = {
	title: "Activities",
};

export default async function ActivitiesPage() {
	await requireSession();

	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<PageShell className="min-h-0 gap-4">
				<PageShellContent className="min-h-0 gap-0">
					<ActivitiesPageClient />
				</PageShellContent>
			</PageShell>
		</div>
	);
}
