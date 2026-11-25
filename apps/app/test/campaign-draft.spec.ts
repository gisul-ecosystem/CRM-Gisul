import { describe, expect, it } from "bun:test";
import {
	type AudienceContact,
	audienceContact,
} from "../lib/outreach/schemas/audience";
import {
	audienceFields,
	signEmail,
	signOffName,
} from "../lib/unifers/campaign-draft";

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

	it("signs with the sending mailbox's first name once", () => {
		const ending = { name: "John", footer: "" };
		const signed = signEmail("Hi there,\n\nA question.\n", ending);
		expect(signed).toBe("Hi there,\n\nA question.\n\nRegards,\nJohn");
		expect(signEmail(signed, ending)).toBe(signed);
	});

	it("adds the footer lines under the name, once", () => {
		const ending = { name: "John", footer: "Racko\n12 MG Road, Bengaluru\n" };
		const signed = signEmail("A question.", ending);
		expect(signed).toBe(
			"A question.\n\nRegards,\nJohn\nRacko\n12 MG Road, Bengaluru",
		);
		expect(signEmail(signed, ending)).toBe(signed);
		expect(signEmail("A question.", { name: null, footer: "Racko" })).toBe(
			"A question.\n\nRacko",
		);
		expect(signEmail("A question.", { name: null, footer: " " })).toBe(
			"A question.",
		);
	});

	it("takes the name from the ticked or default mailbox", () => {
		const mailboxes = [
			{ email: "johnd@getracko.in", fromName: "John D", isDefault: true },
			{ email: "sahil@getracko.in", fromName: "Sahil K", isDefault: false },
			{ email: "john.r@getracko.in", fromName: null, isDefault: false },
		];
		expect(signOffName(mailboxes, [])).toEqual({ kind: "name", name: "John" });
		expect(
			signOffName(mailboxes, ["johnd@getracko.in", "john.r@getracko.in"]),
		).toEqual({ kind: "name", name: "John" });
		expect(
			signOffName(mailboxes, ["johnd@getracko.in", "sahil@getracko.in"]),
		).toEqual({ kind: "mixed", names: ["John", "Sahil"] });
		expect(signOffName([], [])).toEqual({ kind: "none" });
	});
});
