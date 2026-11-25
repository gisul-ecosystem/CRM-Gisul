import { audienceApi } from "@/lib/outreach/api";
import { campaignsApi } from "./api";
import type { DuplicateRule, LeadsResult, UnifersLead } from "./schemas";
import { UNIFERS } from "./unifers-config";

export async function audienceLeads(listId: string): Promise<UnifersLead[]> {
	const leads: UnifersLead[] = [];
	for (let page = 1; ; page += 1) {
		const batch = await audienceApi.contacts({
			page,
			limit: UNIFERS.audienceFetchLimit,
			listId,
		});
		for (const contact of batch.data) {
			if (contact.suppressed || contact.status !== "active") continue;
			const fullName = `${contact.firstName} ${contact.lastName}`.trim();
			leads.push({
				email: contact.email,
				...(fullName ? { fullName } : {}),
				...(contact.company ? { companyName: contact.company } : {}),
			});
		}
		if (batch.data.length === 0 || page * batch.limit >= batch.total) break;
	}
	return leads;
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size)
		out.push(items.slice(i, i + size));
	return out;
}

export function emptyResult(): LeadsResult {
	return {
		received: 0,
		added: 0,
		alreadyInCampaign: 0,
		inOtherCampaign: 0,
		rejected: [],
	};
}

export function mergeResults(a: LeadsResult, b: LeadsResult): LeadsResult {
	return {
		received: a.received + b.received,
		added: a.added + b.added,
		alreadyInCampaign: a.alreadyInCampaign + b.alreadyInCampaign,
		inOtherCampaign: a.inOtherCampaign + b.inOtherCampaign,
		rejected: [...a.rejected, ...b.rejected],
	};
}

export async function addLeadsInBatches(
	campaignId: number,
	leads: readonly UnifersLead[],
	duplicateRule: DuplicateRule,
): Promise<LeadsResult> {
	let total = emptyResult();
	for (const batch of chunks(leads, UNIFERS.maxLeadsPerCall)) {
		const result = await campaignsApi.addLeads(
			campaignId,
			batch,
			duplicateRule,
		);
		total = mergeResults(total, result.leads);
	}
	return total;
}

export function leadsSummary(result: LeadsResult): string {
	return [
		`${result.added} added`,
		result.alreadyInCampaign ? `${result.alreadyInCampaign} already in it` : "",
		result.inOtherCampaign
			? `${result.inOtherCampaign} in another campaign`
			: "",
		result.rejected.length ? `${result.rejected.length} rejected` : "",
	]
		.filter(Boolean)
		.join(" · ");
}
