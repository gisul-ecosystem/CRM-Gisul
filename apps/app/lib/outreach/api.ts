import { z } from "zod";
import { outreachData, outreachPage, outreachReachable } from "./client";
import {
	audienceContact,
	audienceContactPage,
	audienceList,
	audienceListPage,
	type ColumnTarget,
	contactTimelineItem,
	importPreview,
	importReport,
	suppression,
	suppressionImportReport,
	suppressionPage,
	trackedLink,
} from "./schemas/audience";
import {
	type CampaignVariant,
	campaign,
	campaignMessagePage,
	campaignPage,
	campaignPreview,
	campaignStats,
	type SendWindow,
	startCampaignResult,
	testSendResult,
} from "./schemas/campaign";
import {
	activityEntry,
	dashboardCampaign,
	dashboardClicker,
	dashboardInbox,
	dashboardSummary,
	timelineDay,
} from "./schemas/dashboard";
import type {
	CampaignStatus,
	ClickFilter,
	ContactStatus,
	DomainStatus,
	InboxStatus,
	IncomingKindFilter,
	MessageStatus,
	SendFormat,
	SuppressionReason,
	ZeptoRegion,
} from "./schemas/enums";
import {
	incomingEmailDetail,
	incomingEmailPage,
	linkClickPage,
	trackedEmailPage,
	trackedStats,
	trackingConfig,
} from "./schemas/mail";
import { campaignReadiness } from "./schemas/readiness";
import {
	discoveredMailboxes,
	importInboxesResult,
	provider,
	providerPage,
	sendingDomain,
	sendingDomainPage,
	sendingInbox,
	sendingInboxPage,
} from "./schemas/sending";

const removed = z.object({ id: z.string() });

type Paging = { page?: number; limit?: number };

export const dashboardApi = {
	summary: () => outreachData("/dashboard/summary", dashboardSummary),
	inboxes: () => outreachData("/dashboard/inboxes", z.array(dashboardInbox)),
	campaigns: () =>
		outreachData("/dashboard/campaigns", z.array(dashboardCampaign)),
	activity: () => outreachData("/dashboard/activity", z.array(activityEntry)),
	timeline: (days: number) =>
		outreachData("/dashboard/timeline", z.array(timelineDay), {
			query: { days },
		}),
	clickers: (period: "week" | "all", limit: number) =>
		outreachData("/dashboard/clickers", z.array(dashboardClicker), {
			query: { period, limit },
		}),
};

export type CampaignDraft = {
	name?: string;
	listId?: string;
	inboxIds?: string[];
	subjectTemplate?: string;
	bodyTemplate?: string;
	bodyHtml?: string | null;
	sendWindow?: SendWindow;
	templateName?: string;
	variantColumn?: string;
	matchValues?: string[];
	variants?: CampaignVariant[];
	followUpOf?: string | null;
	followUpAfterDays?: number;
};

export const campaignApi = {
	list: (query: Paging & { status?: CampaignStatus; search?: string }) =>
		outreachPage("/campaigns", campaignPage, { query }),
	get: (id: string) => outreachData(`/campaigns/${id}`, campaign),
	create: (draft: CampaignDraft) =>
		outreachData("/campaigns", campaign, { method: "POST", json: draft }),
	update: (id: string, draft: CampaignDraft) =>
		outreachData(`/campaigns/${id}`, campaign, {
			method: "PATCH",
			json: draft,
		}),
	remove: (id: string) =>
		outreachData(`/campaigns/${id}`, removed, { method: "DELETE" }),
	start: (id: string) =>
		outreachData(`/campaigns/${id}/start`, startCampaignResult, {
			method: "POST",
		}),
	pause: (id: string) =>
		outreachData(`/campaigns/${id}/pause`, campaign, { method: "POST" }),
	resume: (id: string) =>
		outreachData(`/campaigns/${id}/resume`, campaign, { method: "POST" }),
	stats: (id: string) => outreachData(`/campaigns/${id}/stats`, campaignStats),
	readiness: (id: string) =>
		outreachData(`/campaigns/${id}/readiness`, campaignReadiness),
	preview: (
		id: string,
		input: {
			contactId?: string;
			subjectTemplate?: string;
			bodyTemplate?: string;
			bodyHtml?: string | null;
		},
	) =>
		outreachData(`/campaigns/${id}/preview`, campaignPreview, {
			method: "POST",
			json: input,
		}),
	testSend: (
		id: string,
		input: { to: string; inboxId?: string; version?: number },
	) =>
		outreachData(`/campaigns/${id}/test-send`, testSendResult, {
			method: "POST",
			json: input,
		}),
	messages: (
		id: string,
		query: Paging & { status?: MessageStatus; search?: string },
	) =>
		outreachPage(`/campaigns/${id}/messages`, campaignMessagePage, { query }),
};

export const audienceApi = {
	contacts: (
		query: Paging & {
			search?: string;
			listId?: string;
			status?: ContactStatus;
		},
	) => outreachPage("/contacts", audienceContactPage, { query }),
	contact: (id: string) => outreachData(`/contacts/${id}`, audienceContact),
	updateContact: (
		id: string,
		input: {
			firstName?: string;
			lastName?: string;
			company?: string;
			title?: string;
			status?: ContactStatus;
			listIds?: string[];
		},
	) =>
		outreachData(`/contacts/${id}`, audienceContact, {
			method: "PATCH",
			json: input,
		}),
	removeContact: (id: string) =>
		outreachData(`/contacts/${id}`, removed, { method: "DELETE" }),
	contactTimeline: (id: string) =>
		outreachData(`/contacts/${id}/timeline`, z.array(contactTimelineItem)),
	contactLinks: (id: string) =>
		outreachData(`/contacts/${id}/links`, z.array(trackedLink)),
	createLink: (
		id: string,
		input: {
			destinationUrl: string;
			domainId?: string;
			label?: string;
			new?: boolean;
		},
	) =>
		outreachData(`/contacts/${id}/links`, trackedLink, {
			method: "POST",
			json: input,
		}),
	previewImport: (file: File) => {
		const form = new FormData();
		form.set("file", file);
		return outreachData("/contacts/import/preview", importPreview, {
			method: "POST",
			form,
		});
	},
	confirmImport: (input: {
		file: File;
		listId: string;
		mapping: { [column: string]: ColumnTarget };
		linkDestinationUrl?: string;
		linkDomainId?: string;
	}) => {
		const form = new FormData();
		form.set("file", input.file);
		form.set("listId", input.listId);
		form.set("mapping", JSON.stringify(input.mapping));
		if (input.linkDestinationUrl)
			form.set("linkDestinationUrl", input.linkDestinationUrl);
		if (input.linkDomainId) form.set("linkDomainId", input.linkDomainId);
		return outreachData("/contacts/import/confirm", importReport, {
			method: "POST",
			form,
		});
	},
	lists: (query: Paging & { search?: string }) =>
		outreachPage("/lists", audienceListPage, { query }),
	createList: (input: { name: string; description?: string }) =>
		outreachData("/lists", audienceList, { method: "POST", json: input }),
	updateList: (id: string, input: { name?: string; description?: string }) =>
		outreachData(`/lists/${id}`, audienceList, {
			method: "PATCH",
			json: input,
		}),
	removeList: (id: string) =>
		outreachData(`/lists/${id}`, removed, { method: "DELETE" }),
	suppressions: (
		query: Paging & { search?: string; reason?: SuppressionReason },
	) => outreachPage("/suppressions", suppressionPage, { query }),
	createSuppression: (input: {
		email: string;
		reason?: SuppressionReason;
		note?: string;
	}) =>
		outreachData("/suppressions", suppression, {
			method: "POST",
			json: input,
		}),
	removeSuppression: (id: string) =>
		outreachData(`/suppressions/${id}`, removed, { method: "DELETE" }),
	importSuppressions: (input: {
		file: File;
		reason?: SuppressionReason;
		note?: string;
	}) => {
		const form = new FormData();
		form.set("file", input.file);
		if (input.reason) form.set("reason", input.reason);
		if (input.note) form.set("note", input.note);
		return outreachData("/suppressions/import", suppressionImportReport, {
			method: "POST",
			form,
		});
	},
};

export const mailApi = {
	replies: (
		query: Paging & {
			kind?: IncomingKindFilter;
			inboxId?: string;
			search?: string;
		},
	) => outreachPage("/incoming-emails", incomingEmailPage, { query }),
	reply: (id: string) =>
		outreachData(`/incoming-emails/${id}`, incomingEmailDetail),
	sent: (
		query: Paging & {
			source?: "manual" | "engine" | "all";
			inboxId?: string;
			search?: string;
			wrongLinksOnly?: boolean;
			from?: string;
			to?: string;
		},
	) => outreachPage("/sent-emails", trackedEmailPage, { query }),
	sentStats: (query: {
		period: "day" | "week" | "month";
		count: number;
		source?: "manual" | "engine" | "all";
		inboxId?: string;
	}) => outreachData("/sent-emails/stats", trackedStats, { query }),
	clicks: (
		query: Paging & {
			include?: ClickFilter;
			inboxId?: string;
			listId?: string;
			contactId?: string;
		},
	) => outreachPage("/tracking/clicks", linkClickPage, { query }),
	trackingConfig: () => outreachData("/tracking/config", trackingConfig),
};

export type ProviderInput =
	| {
			type: "microsoft";
			name: string;
			tenantId: string;
			clientId: string;
			clientSecret: string;
			sendFormat: SendFormat;
	  }
	| {
			type: "zeptomail";
			name: string;
			region: ZeptoRegion;
			apiToken: string;
	  };

export type ProviderUpdate = {
	name?: string;
	tenantId?: string;
	clientId?: string;
	clientSecret?: string;
	sendFormat?: SendFormat;
	region?: ZeptoRegion;
	apiToken?: string;
};

export type InboxInput = {
	domainId: string;
	providerConnectionId: string;
	readingConnectionId?: string | null;
	email: string;
	displayName?: string;
	dailyLimit?: number;
	minGapSeconds?: number;
	maxGapSeconds?: number;
};

export type InboxUpdate = {
	displayName?: string;
	senderName?: string;
	senderRole?: string;
	providerConnectionId?: string;
	readingConnectionId?: string | null;
	dailyLimit?: number;
	minGapSeconds?: number;
	maxGapSeconds?: number;
};

export const sendingApi = {
	domains: (query: Paging & { search?: string; status?: DomainStatus }) =>
		outreachPage("/domains", sendingDomainPage, { query }),
	createDomain: (name: string) =>
		outreachData("/domains", sendingDomain, {
			method: "POST",
			json: { name },
		}),
	updateDomain: (
		id: string,
		input: { status?: DomainStatus; trackingHost?: string | null },
	) =>
		outreachData(`/domains/${id}`, sendingDomain, {
			method: "PATCH",
			json: input,
		}),
	removeDomain: (id: string) =>
		outreachData(`/domains/${id}`, removed, { method: "DELETE" }),
	checkDns: (id: string) =>
		outreachData(`/domains/${id}/check-dns`, sendingDomain, {
			method: "POST",
		}),
	discoverMailboxes: (id: string, providerConnectionId?: string) =>
		outreachData(`/domains/${id}/mailboxes`, discoveredMailboxes, {
			query: { providerConnectionId },
		}),
	importMailboxes: (
		id: string,
		input: {
			emails: string[];
			providerConnectionId?: string;
			startPaused?: boolean;
		},
	) =>
		outreachData(`/domains/${id}/mailboxes/import`, importInboxesResult, {
			method: "POST",
			json: input,
		}),
	inboxes: (
		query: Paging & {
			domainId?: string;
			status?: InboxStatus;
			search?: string;
		},
	) => outreachPage("/inboxes", sendingInboxPage, { query }),
	createInbox: (input: InboxInput) =>
		outreachData("/inboxes", sendingInbox, { method: "POST", json: input }),
	updateInbox: (id: string, input: InboxUpdate) =>
		outreachData(`/inboxes/${id}`, sendingInbox, {
			method: "PATCH",
			json: input,
		}),
	removeInbox: (id: string) =>
		outreachData(`/inboxes/${id}`, removed, { method: "DELETE" }),
	pauseInbox: (id: string, reason?: string) =>
		outreachData(`/inboxes/${id}/pause`, sendingInbox, {
			method: "POST",
			json: { reason },
		}),
	resumeInbox: (id: string) =>
		outreachData(`/inboxes/${id}/resume`, sendingInbox, { method: "POST" }),
	testInbox: (id: string, to: string) =>
		outreachData(`/inboxes/${id}/test-send`, testSendResult, {
			method: "POST",
			json: { to },
		}),
	providers: (query: Paging = {}) =>
		outreachPage("/providers", providerPage, { query }),
	createProvider: (input: ProviderInput) =>
		outreachData("/providers", provider, { method: "POST", json: input }),
	updateProvider: (id: string, input: ProviderUpdate) =>
		outreachData(`/providers/${id}`, provider, {
			method: "PATCH",
			json: input,
		}),
	removeProvider: (id: string) =>
		outreachData(`/providers/${id}`, removed, { method: "DELETE" }),
	verifyProvider: (id: string) =>
		outreachData(`/providers/${id}/verify`, provider, { method: "POST" }),
};

export const healthApi = {
	check: () => outreachReachable("/health"),
};
