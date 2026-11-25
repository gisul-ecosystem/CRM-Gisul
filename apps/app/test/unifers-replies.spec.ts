import { describe, expect, it } from "bun:test";
import { unifersRepliesInput } from "@crm/validation/unifers-send";
import { campaignStart, mergeReplies } from "../lib/unifers/replies";

describe("unifers replies", () => {
	it("reads the campaign start as an ISO time, or none", () => {
		expect(campaignStart("2026-11-25T07:15:00.000Z")).toBe(
			"2026-11-25T07:15:00.000Z",
		);
		expect(campaignStart("not a date")).toBeNull();
		expect(campaignStart(null)).toBeNull();
	});

	it("accepts the start time it builds and lowercases the emails", () => {
		const input = unifersRepliesInput.parse({
			emails: ["Nikhil@Gisul.co.in"],
			since: campaignStart("2026-11-25T07:15:00.000Z"),
		});
		expect(input.emails).toEqual(["nikhil@gisul.co.in"]);
	});
});

describe("merging replies", () => {
	it("keeps the newest reply per lead and the CRM contact link", () => {
		const shown = mergeReplies(
			[
				{
					email: "Asha@Acme.com",
					mailbox: "johnd@getracko.in",
					subject: "Re: GPUs",
					text: "Yes, call me.",
					sentAt: "2026-11-25T09:00:00.000Z",
					webLink: "https://outlook.office.com/x",
				},
			],
			[
				{
					email: "asha@acme.com",
					contactId: "c1",
					subject: "Re: GPUs",
					text: "Older text",
					sentAt: "2026-11-24T09:00:00.000Z",
				},
				{
					email: "ravi@beta.com",
					contactId: "c2",
					subject: null,
					text: "Not now.",
					sentAt: "2026-11-24T10:00:00.000Z",
				},
			],
		);
		expect(shown.get("asha@acme.com")).toMatchObject({
			text: "Yes, call me.",
			contactId: "c1",
			mailbox: "johnd@getracko.in",
		});
		expect(shown.get("ravi@beta.com")?.text).toBe("Not now.");
	});
});
