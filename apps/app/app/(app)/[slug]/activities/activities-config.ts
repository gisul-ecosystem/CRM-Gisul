export const ACTIVITIES = {
	types: ["call", "meeting", "email", "task"] as const,
	owners: ["Rahul Kumar", "Priya Sen", "Ananya Das"] as const,
	viewModes: ["list", "week"] as const,
	quickFilters: [
		"all",
		"today",
		"week",
		"upcoming",
		"overdue",
		"completed",
	] as const,
	tabs: ["all", "call", "meeting", "email", "task"] as const,
	kpiDeltas: {
		today: { dir: "up", value: "20%" },
		completed: { dir: "up", value: "14%" },
		pending: { dir: "nu", value: "-" },
		overdue: { dir: "dn", value: "25%" },
	},
	demo: {
		year: 2025,
		monthIndex: 8,
		day: 25,
	},
} as const;

export type ActivityTypeKey = (typeof ACTIVITIES.types)[number];
export type ActivityViewMode = (typeof ACTIVITIES.viewModes)[number];
export type ActivityQuickFilter = (typeof ACTIVITIES.quickFilters)[number];
export type ActivityTab = (typeof ACTIVITIES.tabs)[number];
export type ActivityStatus = "pending" | "completed" | "overdue";
