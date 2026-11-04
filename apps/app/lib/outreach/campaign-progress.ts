import type { Campaign } from "./schemas/campaign";

export type CampaignProgress = { done: number; target: number };

export function campaignProgress(
	campaign: Pick<Campaign, "counts" | "totalMessages">,
): CampaignProgress {
	return {
		done: campaign.counts.sent,
		target: campaign.totalMessages - campaign.counts.skipped,
	};
}

export function isEditable(campaign: Pick<Campaign, "status">): boolean {
	return campaign.status === "draft" || campaign.status === "paused";
}
