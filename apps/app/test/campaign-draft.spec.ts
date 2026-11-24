import { describe, expect, it } from "bun:test";
import {
	type AudienceContact,
	audienceContact,
} from "../lib/outreach/schemas/audience";
import { audienceFields, withSignOff } from "../lib/unifers/campaign-draft";

function contact(company: string, title: string): AudienceContact {
	return audienceContact.parse({
		id: `${company}-${title}`,
		email: "asha@example.com",
		firstName: "Asha",
		lastName: "",
		company,
		title,
		custom: {},
		listIds: [],
		status: "active",
		suppressed: false,
		engagement: {
			emailsSent: 0,
			lastEmailedAt: null,
			replyCount: 0,
			lastRepliedAt: null,
			clickCount: 0,
			realClickCount: 0,
			lastClickedAt: null,
		},
		createdAt: "2026-11-24T00:00:00.000Z",
		updatedAt: "2026-11-24T00:00:00.000Z",
	});
}

describe("campaign draft fields", () => {
	it("uses the company placeholder only when the list has companies", () => {
		expect(audienceFields([contact("", "CTO")]).placeholders).toEqual([
			"{{firstName | there}}",
		]);
		const fields = audienceFields([
			contact("Acme", "CTO"),
			contact("Acme", "Founder"),
			contact("Beta", "CTO"),
		]);
		expect(fields.placeholders).toContain("{{company.name | your team}}");
		expect(fields.titles[0]).toBe("CTO");
		expect(fields.companies[0]).toBe("Acme");
	});

	it("adds the sender sign-off once", () => {
		const signed = withSignOff("Hi there,\n\nA question.\n");
		expect(signed).toBe(
			"Hi there,\n\nA question.\n\nRegards,\n{{sender.firstName}}",
		);
		expect(withSignOff(signed)).toBe(signed);
	});
});
