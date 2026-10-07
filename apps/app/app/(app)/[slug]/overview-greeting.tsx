"use client";

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
	return (
		<div>
			<h1 className={styles.greetTitle} suppressHydrationWarning>
				{dayPart()}, {first} 👋
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
