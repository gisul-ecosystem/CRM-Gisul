import {
	downloadFromPipeline,
	type PipelineQuery,
	pipelineJson,
} from "./client";
import {
	type CustomSearchInput,
	customSearchList,
	customSearchPreview,
	type LeadFilters,
	type LeadProfile,
	leadsPage,
	okMessage,
	pipelineSettings,
	pipelineStatus,
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
		latest: filters.latest,
		per_company: filters.perCompany,
	};
}

export const pipelineApi = {
	status: () => pipelineJson("/status", pipelineStatus),
	log: (profile: LeadProfile) =>
		pipelineJson("/log", runLog, { query: { profile } }),
	run: (profile: LeadProfile, batch: number, sources: readonly string[]) =>
		pipelineJson("/run", okMessage, {
			method: "POST",
			json: { profile, batch, sources },
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

export const settingsApi = {
	get: (profile: LeadProfile) =>
		pipelineJson("/settings", pipelineSettings, { query: { profile } }),
	save: (update: SettingsUpdate) =>
		pipelineJson("/settings", pipelineSettings, {
			method: "POST",
			json: update,
		}),
};
