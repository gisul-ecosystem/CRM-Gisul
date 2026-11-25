import { unifersJson } from "./client";
import { type TenantRepliesRequest, tenantRepliesResponse } from "./replies";
import {
	addLeadsResponse,
	analyticsResponse,
	type CampaignAction,
	campaignLeadsResponse,
	campaignResponse,
	campaignsResponse,
	connectAccountResponse,
	createCampaignResponse,
	type DuplicateRule,
	disconnectResponse,
	emailAccountsResponse,
	type LeadEvent,
	type NewCampaign,
	type SmtpConnection,
	type UnifersLead,
} from "./schemas";
import { UNIFERS } from "./unifers-config";

export const accountsApi = {
	list: () => unifersJson("/email-accounts", emailAccountsResponse),
	connectSmtp: (connection: SmtpConnection) =>
		unifersJson("/email-accounts", connectAccountResponse, {
			method: "POST",
			json: connection,
		}),
	connectGoogle: () =>
		unifersJson("/email-accounts", connectAccountResponse, {
			method: "POST",
			json: { provider: "google" },
		}),
	disconnect: (email: string) =>
		unifersJson(
			`/email-accounts/${encodeURIComponent(email)}`,
			disconnectResponse,
			{ method: "DELETE" },
		),
};

export const campaignsApi = {
	list: (offset: number, limit: number = UNIFERS.pageSize) =>
		unifersJson("/campaigns", campaignsResponse, {
			query: { limit, offset },
		}),
	create: (input: NewCampaign) =>
		unifersJson("/campaigns", createCampaignResponse, {
			method: "POST",
			json: input,
		}),
	analytics: (id: number) =>
		unifersJson(`/campaigns/${id}/analytics`, analyticsResponse),
	leads: (id: number, event: LeadEvent, offset: number) =>
		unifersJson(`/campaigns/${id}/leads`, campaignLeadsResponse, {
			query: { event, limit: UNIFERS.leadsPageSize, offset },
		}),
	addLeads: (id: number, leads: UnifersLead[], duplicateRule: DuplicateRule) =>
		unifersJson(`/campaigns/${id}/leads`, addLeadsResponse, {
			method: "POST",
			json: { leads, duplicateRule },
		}),
	setStatus: (id: number, action: CampaignAction, startAt?: string) =>
		unifersJson(`/campaigns/${id}/status`, campaignResponse, {
			method: "POST",
			json: startAt ? { action, startAt } : { action },
		}),
};

export const repliesApi = {
	fromTenant: (input: TenantRepliesRequest) =>
		unifersJson("/replies", tenantRepliesResponse, {
			method: "POST",
			json: input,
		}),
};
