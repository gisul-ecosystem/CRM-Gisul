import { describe, expect, it } from "bun:test";
import { campaignTotals, percentOf } from "../lib/unifers/overview";
import { analyticsResponse } from "../lib/unifers/schemas";

function stats(id: number, status: string, sent: number, replied: number) {
	const counts = {
		sent,
		delivered: sent,
		opened: 2,
		clicked: 1,
		replied,
		bounced: 0,
		totalOpens: 2,
		totalClicks: 1,
	};
	return analyticsResponse.parse({
		campaign: { id, name: `C${id}`, status },
		leads: {
			total: sent,
			enrolled: sent,
			active: 0,
			completed: sent,
			exited: 0,
			failed: 0,
			paused: 0,
		},
		email: {
			...counts,
			rates: {
				deliveredPctOfSent: 100,
				bouncedPctOfSent: 0,
				openedPctOfDelivered: 0,
				clickedPctOfDelivered: 0,
				repliedPctOfDelivered: 0,
			},
		},
		steps: [],
	});
}

describe("unifers overview", () => {
	it("adds up every campaign and counts the running ones", () => {
		const totals = campaignTotals([
			stats(1, "active", 10, 2),
			stats(2, "completed", 5, 1),
		]);
		expect(totals).toMatchObject({
			campaigns: 2,
			running: 1,
			leads: 15,
			sent: 15,
			opened: 4,
			replied: 3,
		});
	});

	it("gives zero percent when nothing was sent", () => {
		expect(percentOf(3, 0)).toBe(0);
		expect(percentOf(1, 4)).toBe(25);
	});
});
