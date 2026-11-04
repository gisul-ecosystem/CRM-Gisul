import type { StatusTone } from "@crm/ui/components/status-indicator";
import type {
	CampaignStatus,
	ClickVerdict,
	ContactStatus,
	DnsCheckResult,
	DomainStatus,
	InboxStatus,
	IncomingEmailKind,
	MessageStatus,
	ProviderStatus,
	SuppressionReason,
	TrackedEmailSource,
} from "./schemas/enums";

export type StatusLabel = { label: string; tone: StatusTone };

export const CAMPAIGN_STATUS = {
	draft: { label: "Draft", tone: "neutral" },
	running: { label: "Running", tone: "success" },
	paused: { label: "Paused", tone: "warning" },
	completed: { label: "Completed", tone: "info" },
} as const satisfies Record<CampaignStatus, StatusLabel>;

export const MESSAGE_STATUS = {
	pending: { label: "Waiting", tone: "neutral" },
	scheduled: { label: "Scheduled", tone: "info" },
	sending: { label: "Sending", tone: "primary" },
	sent: { label: "Sent", tone: "success" },
	failed: { label: "Failed", tone: "error" },
	skipped: { label: "Skipped", tone: "warning" },
} as const satisfies Record<MessageStatus, StatusLabel>;

export const INBOX_STATUS = {
	active: { label: "Active", tone: "success" },
	paused: { label: "Paused", tone: "warning" },
	error: { label: "Error", tone: "error" },
} as const satisfies Record<InboxStatus, StatusLabel>;

export const DOMAIN_STATUS = {
	active: { label: "Active", tone: "success" },
	paused: { label: "Paused", tone: "warning" },
} as const satisfies Record<DomainStatus, StatusLabel>;

export const PROVIDER_STATUS = {
	connected: { label: "Connected", tone: "success" },
	error: { label: "Error", tone: "error" },
	unchecked: { label: "Not verified", tone: "neutral" },
} as const satisfies Record<ProviderStatus, StatusLabel>;

export const DNS_RESULT = {
	pass: { label: "Pass", tone: "success" },
	fail: { label: "Fail", tone: "error" },
	unknown: { label: "Not checked", tone: "neutral" },
} as const satisfies Record<DnsCheckResult, StatusLabel>;

export const CONTACT_STATUS = {
	active: { label: "Active", tone: "success" },
	unsubscribed: { label: "Unsubscribed", tone: "warning" },
	bounced: { label: "Bounced", tone: "error" },
} as const satisfies Record<ContactStatus, StatusLabel>;

export const SUPPRESSION_REASON = {
	unsubscribed: { label: "Unsubscribed", tone: "warning" },
	bounced: { label: "Bounced", tone: "error" },
	manual: { label: "Added by hand", tone: "neutral" },
	complaint: { label: "Complaint", tone: "error" },
} as const satisfies Record<SuppressionReason, StatusLabel>;

export const CLICK_VERDICT = {
	click: { label: "Real click", tone: "success" },
	suspicious: { label: "Maybe a bot", tone: "warning" },
	bot: { label: "Bot", tone: "neutral" },
} as const satisfies Record<ClickVerdict, StatusLabel>;

export const INCOMING_KIND = {
	reply: { label: "Reply", tone: "success" },
	bounce: { label: "Bounce", tone: "error" },
	auto_reply: { label: "Auto-reply", tone: "info" },
	other: { label: "Other", tone: "neutral" },
} as const satisfies Record<IncomingEmailKind, StatusLabel>;

export const TRACKED_SOURCE = {
	manual: { label: "By hand", tone: "info" },
	engine: { label: "Campaign", tone: "primary" },
} as const satisfies Record<TrackedEmailSource, StatusLabel>;

export const SENDING_MODE_LABEL = {
	"dry-run": {
		label: "Dry run",
		tone: "info",
		description: "Emails are simulated. Nothing leaves the engine.",
	},
	live: {
		label: "Live",
		tone: "success",
		description: "Real emails are sent.",
	},
	disabled: {
		label: "Sending off",
		tone: "warning",
		description:
			"The kill switch is on. The worker plans and sends nothing until SENDING_ENABLED is true.",
	},
} as const satisfies Record<
	"dry-run" | "live" | "disabled",
	StatusLabel & { description: string }
>;

export const WEEKDAYS = [
	{ day: 1, short: "Mon", long: "Monday" },
	{ day: 2, short: "Tue", long: "Tuesday" },
	{ day: 3, short: "Wed", long: "Wednesday" },
	{ day: 4, short: "Thu", long: "Thursday" },
	{ day: 5, short: "Fri", long: "Friday" },
	{ day: 6, short: "Sat", long: "Saturday" },
	{ day: 7, short: "Sun", long: "Sunday" },
] as const;

export const MINUTES_PER_HOUR = 60;

export function minuteToTime(minute: number): string {
	const hours = Math.floor(minute / MINUTES_PER_HOUR);
	const minutes = minute % MINUTES_PER_HOUR;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinute(value: string): number {
	const [hours = "0", minutes = "0"] = value.split(":");
	return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

export function windowSummary(window: {
	startMinute: number;
	endMinute: number;
	days: number[];
}): string {
	const days = WEEKDAYS.filter((weekday) => window.days.includes(weekday.day))
		.map((weekday) => weekday.short)
		.join(", ");
	return `${days || "No days"} · ${minuteToTime(window.startMinute)}–${minuteToTime(window.endMinute)}`;
}
