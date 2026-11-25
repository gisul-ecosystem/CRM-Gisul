"use client";

import Moon from "@carbon/icons-react/es/Moon";
import Sun from "@carbon/icons-react/es/Sun";
import { Icon } from "@crm/ui/components/icon";
import styles from "./dashboard-design.module.css";

export function OverviewGreetingFallback() {
	return (
		<div>
			<h1 className={styles.greetTitle}>Good morning</h1>
			<p className={styles.greetSub}>
				Here&apos;s what&apos;s happening across your sales pipeline today.
			</p>
		</div>
	);
}

export function OverviewGreeting({ name }: { name: string }) {
	const first = name.trim().split(/\s+/)[0] ?? name;
	const hour = new Date().getHours();
	return (
		<div>
			<h1 className={styles.greetTitle} suppressHydrationWarning>
				<span className={styles.greetLead}>
					<Icon
						icon={hour < 17 ? Sun : Moon}
						className={styles.greetIcon}
					/>
					{dayPart()}, {first}
				</span>
			</h1>
			<p className={styles.greetSub}>
				Here&apos;s what&apos;s happening across your sales pipeline today.
			</p>
		</div>
	);
}

function dayPart(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}
