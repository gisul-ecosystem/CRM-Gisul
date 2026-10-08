export const DASHBOARD = {
	chart: {
		yTickFractions: [1, 0.75, 0.5, 0.25, 0] as const,
		minBarPercent: 4,
	},
	performance: {
		metrics: [
			{ id: "won", label: "Won revenue" },
			{ id: "created", label: "Created value" },
		],
		ranges: [
			{ months: 3, label: "Last 3 months" },
			{ months: 6, label: "Last 6 months" },
			{ months: 12, label: "Last 12 months" },
		],
	},
} as const;
