import {
	downloadFromPipeline,
	type PipelineQuery,
	pipelineJson,
} from "./client";
import {
	type PartnerEnrichItem,
	type PartnerSearchInput,
	partnerEnrichResult,
	partnerLog,
	partnerOverview,
	partnerPreview,
	partnerResults,
} from "./partner-schemas";
import {
	type CustomSearchInput,
	customSearchList,
	customSearchPreview,
	type Lead,
	type LeadFilters,
	type LeadProfile,
	leadsPage,
	okMessage,
	pipelineSettings,
	pipelineStatus,
	type RejectScope,
	rejectResult,
	runLog,
	type SettingsUpdate,
} from "./schemas";

function filterQuery(
	profile: LeadProfile,
	filters: LeadFilters,
): PipelineQuery {
	return {
		profile,
		q: filters.q.trim(),
		ready: filters.ready,
		has_email: filters.hasEmail,
		intent: filters.intent,
		segment: filters.segment,
		country: filters.country,
		source: filters.source,
		since: filters.foundFrom,
		until: filters.foundTo,
		sort: filters.sort,
		latest: filters.latest,
		per_company: filters.perCompany,
	};
}

export const pipelineApi = {
	status: () => pipelineJson("/status", pipelineStatus),
	log: (profile: LeadProfile) =>
		pipelineJson("/log", runLog, { query: { profile } }),
	run: (
		profile: LeadProfile,
		batch: number,
		sources: readonly string[],
		countries: readonly string[],
	) =>
		pipelineJson("/run", okMessage, {
			method: "POST",
			json: { profile, batch, sources, countries },
		}),
	stop: (profile: LeadProfile) =>
		pipelineJson("/stop", okMessage, { method: "POST", json: { profile } }),
};

export const leadsApi = {
	list: (
		profile: LeadProfile,
		filters: LeadFilters,
		page: number,
		pageSize: number,
	) =>
		pipelineJson("/leads", leadsPage, {
			query: { ...filterQuery(profile, filters), page, pageSize },
		}),
	reject: (
		profile: LeadProfile,
		scope: RejectScope,
		leads: readonly Pick<Lead, "domain" | "full_name" | "email">[],
		reason: string,
	) =>
		pipelineJson("/leads/reject", rejectResult, {
			method: "POST",
			json: {
				profile,
				scope,
				reason,
				leads: leads.map(({ domain, full_name, email }) => ({
					domain,
					full_name,
					email,
				})),
			},
		}),
	download: (profile: LeadProfile, filters: LeadFilters) =>
		downloadFromPipeline("/download", filterQuery(profile, filters)),
};

export const customSearchApi = {
	list: (profile: LeadProfile) =>
		pipelineJson("/custom-search", customSearchList, { query: { profile } }),
	preview: (input: CustomSearchInput) =>
		pipelineJson("/custom-search/preview", customSearchPreview, {
			method: "POST",
			json: input,
		}),
	start: (input: CustomSearchInput) =>
		pipelineJson("/custom-search", okMessage, {
			method: "POST",
			json: input,
		}),
};

export const partnersApi = {
	overview: () => pipelineJson("/partners", partnerOverview),
	preview: (input: PartnerSearchInput) =>
		pipelineJson("/partners/preview", partnerPreview, {
			method: "POST",
			json: input,
		}),
	start: (input: PartnerSearchInput) =>
		pipelineJson("/partners", okMessage, { method: "POST", json: input }),
	results: (run: string) =>
		pipelineJson("/partners/results", partnerResults, { query: { run } }),
	log: () => pipelineJson("/partners/log", partnerLog),
	stop: () =>
		pipelineJson("/partners/stop", okMessage, { method: "POST", json: {} }),
	enrich: (items: PartnerEnrichItem[]) =>
		pipelineJson("/partners/enrich", partnerEnrichResult, {
			method: "POST",
			json: { items },
		}),
};

export const settingsApi = {
	get: (profile: LeadProfile) =>
		pipelineJson("/settings", pipelineSettings, { query: { profile } }),
	save: (update: SettingsUpdate) =>
		pipelineJson("/settings", pipelineSettings, {
			method: "POST",
			json: update,
		}),
};
