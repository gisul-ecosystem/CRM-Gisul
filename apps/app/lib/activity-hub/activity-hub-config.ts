export const ACTIVITY_HUB = {
	title: "Activities & Reports",
	tabs: [
		{ id: "activities", label: "Activities", href: "/activities" },
		{ id: "reports", label: "Reports", href: "/reports" },
	],
} as const;

export type ActivityHubTab = (typeof ACTIVITY_HUB.tabs)[number]["id"];
