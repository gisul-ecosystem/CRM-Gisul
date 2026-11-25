import { describe, expect, it } from "bun:test";
import type { CampaignAnalytics } from "../lib/unifers/schemas";
import {
	defaultFollowUpDay,
	engagementLine,
	followUpSubject,
	senderNameForAccount,
	sendStatus,
	swapSenderName,
	waitDaysUntil,
} from "../lib/unifers/single-send";

const TODAY = new Date(2026, 10, 16, 15, 30);

const counts = (over: Partial<CampaignAnalytics["email"]> = {}) => ({
	sent: 1,
	delivered: 1,
	opened: 0,
	clicked: 0,
	replied: 0,
	bounced: 0,
	totalOpens: 0,
	totalClicks: 0,
	...over,
});

function analytics(
	first: Partial<CampaignAnalytics["email"]>,
	secondSent: number | null,
	status: CampaignAnalytics["campaign"]["status"] = "active",
): CampaignAnalytics {
	const steps: CampaignAnalytics["steps"] = [
		{
			id: "email_1",
			type: "email_send",
			subject: "Hi",
			wait: "",
			waiting: 0,
			ended: 0,
			email: counts(first),
		},
	];
	if (secondSent !== null) {
		steps.push(
			{
				id: "wait_2",
				type: "wait",
				subject: "",
				wait: "3d",
				waiting: 1,
				ended: 0,
				email: null,
			},
			{
				id: "email_3",
				type: "email_send",
				subject: "Re: Hi",
				wait: "",
				waiting: 0,
				ended: 0,
				email: counts({ sent: secondSent, delivered: secondSent }),
			},
		);
	}
	return {
		campaign: { status } as CampaignAnalytics["campaign"],
		leads: {
			total: 1,
			enrolled: 1,
			active: 1,
			completed: 0,
			exited: 0,
			failed: 0,
			paused: 0,
		},
		email: {
			...counts(first),
			rates: {
				deliveredPctOfSent: 100,
				bouncedPctOfSent: 0,
				openedPctOfDelivered: 0,
				clickedPctOfDelivered: 0,
				repliedPctOfDelivered: 0,
			},
		},
		steps,
	};
}

describe("single send follow-up", () => {
	it("counts whole days and never schedules for today", () => {
		expect(waitDaysUntil("2026-11-19", TODAY)).toBe(3);
		expect(waitDaysUntil("2026-11-16", TODAY)).toBe(1);
		expect(waitDaysUntil("2026-11-01", TODAY)).toBe(1);
	});

	it("starts from the contact's future follow-up date, else three days out", () => {
		expect(defaultFollowUpDay("2026-11-25T00:00:00.000Z", TODAY)).toBe(
			"2026-11-25",
		);
		expect(defaultFollowUpDay("2026-11-10T00:00:00.000Z", TODAY)).toBe(
			"2026-11-19",
		);
		expect(defaultFollowUpDay(null, TODAY)).toBe("2026-11-19");
	});

	it("keeps one Re: on the subject", () => {
		expect(followUpSubject("Racko for your team")).toBe(
			"Re: Racko for your team",
		);
		expect(followUpSubject("Re: Racko")).toBe("Re: Racko");
	});
});

describe("send status", () => {
	it("shows a reply and stops the follow-up", () => {
		const status = sendStatus(
			analytics({ opened: 1, replied: 1 }, 0),
			"2026-11-19",
		);
		expect(status.label).toBe("Replied");
		expect(status.followUp).toBe("Follow-up stopped: they replied");
	});

	it("shows the follow-up date while it waits, and sent once it goes", () => {
		const waiting = sendStatus(analytics({ opened: 1 }, 0), "2026-11-19");
		expect(waiting.label).toBe("Opened");
		expect(waiting.followUp).toBe("Follow-up on 2026-11-19");
		expect(sendStatus(analytics({}, 1), "2026-11-19").followUp).toBe(
			"Follow-up sent",
		);
	});

	it("has no follow-up line for a single email, and flags a bounce", () => {
		expect(sendStatus(analytics({}, null), null).followUp).toBeNull();
		expect(
			sendStatus(analytics({ bounced: 1, delivered: 0 }, 0), "2026-11-19")
				.label,
		).toBe("Bounced");
	});

	it("reports a click even when a reply outranks it", () => {
		const status = sendStatus(
			analytics(
				{ opened: 1, totalOpens: 3, clicked: 1, totalClicks: 2, replied: 1 },
				null,
			),
			null,
		);
		expect(status.label).toBe("Replied");
		expect(engagementLine(status.engagement)).toBe(
			"Opened 3 times · Clicked 2 times · Replied",
		);
		expect(
			engagementLine(sendStatus(analytics({}, null), null).engagement),
		).toBe("Not opened · No clicks · No reply");
	});
});

describe("sender switching", () => {
	it("derives display name from fromName or email", () => {
		expect(
			senderNameForAccount({ fromName: "Nikhil Gupta", email: "nikhil@gisul.co.in" }),
		).toBe("Nikhil Gupta");
		expect(
			senderNameForAccount({ fromName: null, email: "sales.team@gisul.co.in" }),
		).toBe("Sales Team");
		expect(
			senderNameForAccount({ fromName: "", email: "alex-turner@gisul.co.in" }),
		).toBe("Alex Turner");
		expect(senderNameForAccount(null)).toBe("");
	});

	it("swaps sign-off name without changing the recipient greeting", () => {
		const body = "Hi Nikhil,\n\nI saw your post on LinkedIn.\n\nBest,\nNikhil";
		const swapped = swapSenderName(body, "Nikhil", "Rahul");
		expect(swapped).toBe("Hi Nikhil,\n\nI saw your post on LinkedIn.\n\nBest,\nRahul");
	});

	it("swaps intro and sign-off name across multiple senders", () => {
		const body = "Hi John,\n\nI'm Nikhil from Gisul.\n\nThanks,\nNikhil";
		const toGisul = swapSenderName(body, "Nikhil", "Gisul Team");
		expect(toGisul).toBe("Hi John,\n\nI'm Gisul Team from Gisul.\n\nThanks,\nGisul Team");
		const toPriya = swapSenderName(toGisul, "Gisul Team", "Priya Sharma");
		expect(toPriya).toBe("Hi John,\n\nI'm Priya Sharma from Gisul.\n\nThanks,\nPriya Sharma");
	});

	it("replaces signature line when sign-off word exists", () => {
		const body = "Hi John,\n\nLooking forward to speaking.\n\nWarm regards,\nPrevious Person";
		expect(swapSenderName(body, "Previous Person", "Nikhil")).toBe(
			"Hi John,\n\nLooking forward to speaking.\n\nWarm regards,\nNikhil",
		);
	});

	it("swaps follow-up signature line", () => {
		const followUp = "Hi John,\n\nFollowing up on my previous note.\n\nBest,\nNikhil";
		expect(swapSenderName(followUp, "Nikhil", "Sales Team")).toBe(
			"Hi John,\n\nFollowing up on my previous note.\n\nBest,\nSales Team",
		);
	});
});
