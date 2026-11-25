import { Bebas_Neue, Poppins } from "next/font/google";
import { Suspense } from "react";
import styles from "./settings-design.module.css";
import { SettingsSidebar, SettingsSidebarFallback } from "./settings-sidebar";

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

export default function SettingsLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className={`${display.variable} ${sans.variable} ${styles.shell}`}>
			<div className={styles.frame}>
				<Suspense fallback={<SettingsSidebarFallback />}>
					<SettingsSidebar />
				</Suspense>
				<div className={styles.main}>{children}</div>
			</div>
		</div>
	);
}
