import type { StatusTone } from "@crm/ui/components/status-indicator";
import type {
	ACCOUNT_STATUSES,
	CampaignStatus,
	DuplicateRule,
	LeadEvent,
} from "./schemas";

type StatusLabel = { label: string; tone: StatusTone };

export const UNIFERS_CAMPAIGN_STATUS = {
	draft: { label: "Draft", tone: "neutral" },
	scheduled: { label: "Scheduled", tone: "info" },
	active: { label: "Running", tone: "success" },
	paused: { label: "Paused", tone: "warning" },
	completed: { label: "Completed", tone: "info" },
	cancelled: { label: "Cancelled", tone: "error" },
	archived: { label: "Archived", tone: "neutral" },
} as const satisfies Record<CampaignStatus, StatusLabel>;

export const UNIFERS_ACCOUNT_STATUS = {
	pending: { label: "Pending", tone: "neutral" },
	verified: { label: "Verified", tone: "success" },
	failed: { label: "Failed", tone: "error" },
	revoked: { label: "Revoked", tone: "warning" },
	disconnected: { label: "Disconnected", tone: "neutral" },
} as const satisfies Record<(typeof ACCOUNT_STATUSES)[number], StatusLabel>;

export const LEAD_EVENT_LABEL = {
	sent: "Sent",
	delivered: "Delivered",
	opened: "Opened",
	clicked: "Clicked",
	replied: "Replied",
} as const satisfies Record<LeadEvent, string>;

export const DUPLICATE_RULE_LABEL = {
	this_campaign: "Skip people already in this campaign",
	active_campaigns: "Also skip people in a running or scheduled campaign",
	any_campaign: "Also skip people in any other campaign",
} as const satisfies Record<DuplicateRule, string>;

export const WEEKDAYS = [
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
	{ value: 7, label: "Sun" },
] as const;
