export const LEAD_HUB = {
	viewParam: "view",
	pages: {
		overview: "/lead-generation",
		find: "/lead-generation/find",
		leads: "/lead-generation/leads",
		messages: "/lead-generation/messages",
		settings: "/lead-generation/settings",
	},
	views: {
		overview: { website: "website", linkedin: "linkedin" },
		find: { website: "website", linkedin: "linkedin", partners: "partners" },
		leads: {
			website: "website",
			profiles: "profiles",
			posts: "posts",
			companies: "companies",
		},
		messages: { queue: "queue", sent: "sent" },
	},
} as const;

type HubPage = keyof typeof LEAD_HUB.pages;

export function hubPath(page: HubPage, view?: string): string {
	const path = LEAD_HUB.pages[page];
	return view ? `${path}?${LEAD_HUB.viewParam}=${view}` : path;
}
