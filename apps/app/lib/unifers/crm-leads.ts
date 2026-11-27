import {
	LEAD_ORIGIN_LIMITS,
	type LeadCategory,
} from "@crm/validation/lead-origin";
import type { Lead, LeadProfile } from "@/lib/leads-pipeline/schemas";
import type { RouterInputs } from "@/lib/trpc/types";

export type CrmLeadImport = RouterInputs["contacts"]["importLeads"];

type ImportRow = CrmLeadImport["leads"][number];

export type CampaignPerson = { email: string; name: string };

export type PipelineMatch = { profile: LeadProfile; lead: Lead };

export const CAMPAIGN_SOURCE = "Unifers campaign";

function cut(text: string, max: number): string {
	return text.trim().slice(0, max);
}

function nameOf(person: CampaignPerson, lead: Lead | null): string {
	return (
		lead?.full_name.trim() ||
		person.name.trim() ||
		person.email.split("@")[0] ||
		person.email
	);
}

function domainOf(email: string): string {
	return email.split("@")[1]?.toLowerCase() ?? "";
}

export function crmImportsFor(
	people: readonly CampaignPerson[],
	matches: readonly PipelineMatch[],
	activity: string,
	leadSource: CrmLeadImport["leadSource"],
): CrmLeadImport[] {
	const byEmail = new Map(
		matches.map((match) => [match.lead.email.trim().toLowerCase(), match]),
	);
	const groups = new Map<LeadCategory | null, ImportRow[]>();
	for (const person of people) {
		const match = byEmail.get(person.email.trim().toLowerCase()) ?? null;
		const lead = match?.lead ?? null;
		const row: ImportRow = {
			fullName: nameOf(person, lead),
			email: person.email.trim(),
			phone: lead?.phone ?? "",
			title: lead?.title ?? "",
			company: lead?.company ?? "",
			domain: lead?.domain || domainOf(person.email),
			linkedinUrl: lead?.linkedin_url ?? "",
			origin: {
				segment: cut(lead?.segment ?? "", LEAD_ORIGIN_LIMITS.segment),
				country: cut(lead?.country ?? "", LEAD_ORIGIN_LIMITS.country),
				signal: cut(
					lead?.signal ? `${lead.signal} · ${activity}` : activity,
					LEAD_ORIGIN_LIMITS.signal,
				),
				source: cut(lead?.source || CAMPAIGN_SOURCE, LEAD_ORIGIN_LIMITS.source),
				companySize: cut(lead?.team_size ?? "", LEAD_ORIGIN_LIMITS.companySize),
				opener: "",
				evidence: lead?.signal_url
					? [
							{
								title: cut(
									lead.signal || lead.company,
									LEAD_ORIGIN_LIMITS.evidenceTitle,
								),
								url: cut(lead.signal_url, LEAD_ORIGIN_LIMITS.evidenceUrl),
								source: cut(lead.source, LEAD_ORIGIN_LIMITS.evidenceField),
								date: cut(lead.date_found, LEAD_ORIGIN_LIMITS.evidenceField),
								agency: "",
								value: "",
							},
						]
					: [],
			},
		};
		const category = match?.profile ?? null;
		groups.set(category, [...(groups.get(category) ?? []), row]);
	}
	return [...groups.entries()].map(([category, leads]) => ({
		leadSource,
		category,
		leads,
	}));
}
