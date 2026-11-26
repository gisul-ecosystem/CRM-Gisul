import type { CampaignAnalytics } from "./schemas";

export type UnifersTotals = {
	campaigns: number;
	running: number;
	leads: number;
	sent: number;
	delivered: number;
	opened: number;
	clicked: number;
	replied: number;
	bounced: number;
};

export const EMPTY_TOTALS: UnifersTotals = {
	campaigns: 0,
	running: 0,
	leads: 0,
	sent: 0,
	delivered: 0,
	opened: 0,
	clicked: 0,
	replied: 0,
	bounced: 0,
};

export function campaignTotals(
	analytics: readonly CampaignAnalytics[],
): UnifersTotals {
	return analytics.reduce<UnifersTotals>(
		(total, { campaign, leads, email }) => ({
			campaigns: total.campaigns + 1,
			running: total.running + (campaign.status === "active" ? 1 : 0),
			leads: total.leads + leads.total,
			sent: total.sent + email.sent,
			delivered: total.delivered + email.delivered,
			opened: total.opened + email.opened,
			clicked: total.clicked + email.clicked,
			replied: total.replied + email.replied,
			bounced: total.bounced + email.bounced,
		}),
		EMPTY_TOTALS,
	);
}

export function percentOf(part: number, whole: number): number {
	return whole > 0 ? (part / whole) * 100 : 0;
}
