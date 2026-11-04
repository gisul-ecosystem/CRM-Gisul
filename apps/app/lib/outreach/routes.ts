export const SETUP_TABS = ["inboxes", "domains", "providers"] as const;
export type SetupTab = (typeof SETUP_TABS)[number];

export const AUDIENCE_TABS = ["contacts", "lists", "suppressions"] as const;
export type AudienceTab = (typeof AUDIENCE_TABS)[number];

export const SENT_TABS = ["emails", "clicks"] as const;
export type SentTab = (typeof SENT_TABS)[number];

const ENGINE_PAGE_TO_CRM = new Map<string, string>([
	["/inboxes", "/outreach/setup?tab=inboxes"],
	["/domains", "/outreach/setup?tab=domains"],
	["/providers", "/outreach/setup?tab=providers"],
	["/contacts", "/outreach/audiences"],
	["/campaigns", "/outreach/campaigns"],
	["/sent", "/outreach/sent"],
	["/inbox", "/outreach/replies"],
]);

export function crmPathForEnginePage(enginePath: string): string {
	return ENGINE_PAGE_TO_CRM.get(enginePath) ?? "/outreach";
}
