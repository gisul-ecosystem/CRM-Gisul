import type { StatusTone } from "@crm/ui/components/status-indicator";
import type { CampaignAnalytics } from "./schemas";
import { UNIFERS } from "./unifers-config";

const DAY_MS = 24 * 60 * 60 * 1000;

function localDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function dayStart(day: string): number {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1).getTime();
}

export function waitDaysUntil(day: string, today: Date = new Date()): number {
	const days = Math.round((dayStart(day) - dayStart(localDay(today))) / DAY_MS);
	return Math.max(UNIFERS.singleSend.minFollowUpDays, days);
}

export function defaultFollowUpDay(
	nextFollowUpAt: string | null,
	today: Date = new Date(),
): string {
	const planned = nextFollowUpAt ? nextFollowUpAt.slice(0, 10) : null;
	if (planned && dayStart(planned) > dayStart(localDay(today))) return planned;
	return localDay(
		new Date(today.getTime() + UNIFERS.followUpWaitDays * DAY_MS),
	);
}

export function followUpSubject(subject: string): string {
	const trimmed = subject.trim();
	return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export type SendStatus = {
	label: string;
	tone: StatusTone;
	followUp: string | null;
	engagement: Engagement;
};

export type Engagement = {
	opened: boolean;
	opens: number;
	clicked: boolean;
	clicks: number;
	replied: boolean;
};

function times(count: number): string {
	return count === 1 ? "once" : `${count} times`;
}

export function engagementLine(engagement: Engagement): string {
	return [
		engagement.opened ? `Opened ${times(engagement.opens)}` : "Not opened",
		engagement.clicked ? `Clicked ${times(engagement.clicks)}` : "No clicks",
		engagement.replied ? "Replied" : "No reply",
	].join(" · ");
}

const EMAIL_STEP = "email_send";

export function sendStatus(
	analytics: CampaignAnalytics,
	followUpAt: string | null,
): SendStatus {
	const counts = analytics.email;
	const replied = counts.replied > 0;
	const [, second] = analytics.steps.filter((step) => step.type === EMAIL_STEP);

	const engagement: Engagement = {
		opened: counts.opened > 0,
		opens: Math.max(counts.totalOpens, counts.opened),
		clicked: counts.clicked > 0,
		clicks: Math.max(counts.totalClicks, counts.clicked),
		replied,
	};

	const tone: Omit<SendStatus, "followUp" | "engagement"> = replied
		? { label: "Replied", tone: "success" }
		: counts.bounced > 0
			? { label: "Bounced", tone: "error" }
			: counts.clicked > 0
				? { label: "Clicked", tone: "info" }
				: counts.opened > 0
					? { label: "Opened", tone: "info" }
					: counts.delivered > 0
						? { label: "Delivered", tone: "neutral" }
						: counts.sent > 0
							? { label: "Sent", tone: "neutral" }
							: { label: "Queued", tone: "warning" };

	const status = { ...tone, engagement };

	if (!second) return { ...status, followUp: null };
	if ((second.email?.sent ?? 0) > 0) {
		return { ...status, followUp: "Follow-up sent" };
	}
	if (replied)
		return { ...status, followUp: "Follow-up stopped: they replied" };
	if (counts.bounced > 0) {
		return { ...status, followUp: "Follow-up stopped: the email bounced" };
	}
	if (analytics.campaign.status === "cancelled") {
		return { ...status, followUp: "Follow-up cancelled" };
	}
	return {
		...status,
		followUp: followUpAt ? `Follow-up on ${followUpAt}` : "Follow-up waiting",
	};
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function senderNameForAccount(
	account: { fromName?: string | null; email: string } | null | undefined,
): string {
	if (!account) return "";
	const fromName = account.fromName?.trim();
	if (fromName) return fromName;
	const local = account.email.split("@")[0] || "";
	return local
		.replace(/[._-]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

export function swapSenderName(
	content: string,
	previousName: string,
	nextName: string,
): string {
	if (!content || !nextName || previousName === nextName) {
		return content;
	}

	let updated = content;

	if (previousName.trim()) {
		const introRegex = new RegExp(
			`(\\b(?:I'm|I am|My name is|This is)\\s+)${escapeRegex(previousName.trim())}\\b`,
			"gi",
		);
		updated = updated.replace(introRegex, `$1${nextName}`);

		const prevFirst = previousName.trim().split(/\s+/)[0];
		if (prevFirst && prevFirst !== previousName.trim()) {
			const introFirstRegex = new RegExp(
				`(\\b(?:I'm|I am|My name is|This is)\\s+)${escapeRegex(prevFirst)}\\b`,
				"gi",
			);
			updated = updated.replace(introFirstRegex, `$1${nextName}`);
		}
	}

	const signOffRegex =
		/((\n\s*(?:best regards|warm regards|kind regards|best|regards|thanks|thank you|cheers|sincerely|warmly|yours)[,\s]*\n+)[^\n]+)(\s*)$/i;

	if (signOffRegex.test(updated)) {
		return updated.replace(signOffRegex, `$2${nextName}$3`);
	}

	if (previousName.trim()) {
		const trailingExactRegex = new RegExp(
			`(\\n\\n+)${escapeRegex(previousName.trim())}(\\s*)$`,
		);
		if (trailingExactRegex.test(updated)) {
			return updated.replace(trailingExactRegex, `$1${nextName}$2`);
		}
		const prevFirst = previousName.trim().split(/\s+/)[0];
		if (prevFirst) {
			const trailingFirstRegex = new RegExp(
				`(\\n\\n+)${escapeRegex(prevFirst)}(\\s*)$`,
			);
			if (trailingFirstRegex.test(updated)) {
				return updated.replace(trailingFirstRegex, `$1${nextName}$2`);
			}
		}
	}

	return `${updated.trimEnd()}\n\nBest,\n${nextName}`;
}
