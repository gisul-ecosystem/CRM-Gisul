import { describe, expect, it } from "bun:test";
import { unifersRepliesInput } from "@crm/validation/unifers-send";
import { mailboxFirstName, signEmail } from "../lib/unifers/campaign-draft";
import { campaignStart, mergeReplies, replyHtml } from "../lib/unifers/replies";
import {
	latestInbound,
	odataQuoted,
	threadEntries,
	waitingOnAfter,
} from "../lib/unifers/thread";

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
					mailboxName: "John D",
					messageId: "AAMk1",
					subject: "Re: GPUs",
					text: "Yes, call me.",
					sentAt: "2026-11-25T09:00:00.000Z",
					webLink: "https://outlook.office.com/x",
					waitingOn: "us",
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
			waitingOn: "us",
		});
		expect(shown.get("ravi@beta.com")?.waitingOn).toBeNull();
		expect(shown.get("ravi@beta.com")?.text).toBe("Not now.");
	});
});

describe("replying from the CRM", () => {
	it("turns the typed reply into safe HTML with line breaks", () => {
		expect(replyHtml('Hi <b>Asha</b> & "team",\n\nThanks')).toBe(
			"Hi &lt;b&gt;Asha&lt;/b&gt; &amp; &quot;team&quot;,<br><br>Thanks",
		);
	});

	it("signs the reply with the mailbox's first name", () => {
		const name = mailboxFirstName("johnd@getracko.in", "John D");
		expect(name).toBe("John");
		expect(signEmail("Thanks, Asha.", { name, footer: "" })).toBe(
			"Thanks, Asha.\n\nRegards,\nJohn",
		);
	});
});

describe("the conversation", () => {
	const mailbox = "johnd@getracko.in";
	const message = (
		id: string,
		from: string,
		at: string,
		extra: { isDraft?: boolean; conversationId?: string } = {},
	) => ({
		id,
		from: { emailAddress: { address: from, name: null } },
		subject: "Re: GPUs",
		bodyPreview: `text ${id}`,
		receivedDateTime: at,
		...extra,
	});

	it("orders every sent and received email oldest first and drops drafts", () => {
		const entries = threadEntries(
			[
				message("m3", "asha@acme.com", "2026-11-26T09:00:00.000Z"),
				message("m1", "JohnD@getracko.in", "2026-11-24T09:00:00.000Z"),
				message("m2", "asha@acme.com", "2026-11-25T09:00:00.000Z"),
				message("d1", mailbox, "2026-11-27T09:00:00.000Z", { isDraft: true }),
			],
			mailbox,
		);
		expect(entries.map((entry) => [entry.id, entry.direction])).toEqual([
			["m1", "OUTBOUND"],
			["m2", "INBOUND"],
			["m3", "INBOUND"],
		]);
		expect(latestInbound(entries)?.id).toBe("m3");
	});

	it("waits on us until we answer in the same thread", () => {
		const theirs = message("m2", "asha@acme.com", "2026-11-25T09:00:00.000Z", {
			conversationId: "c1",
		});
		expect(waitingOnAfter(new Set(), theirs)).toBe("us");
		expect(waitingOnAfter(new Set(["c1"]), theirs)).toBe("them");
		expect(waitingOnAfter(new Set(["c2"]), theirs)).toBe("us");
	});

	it("quotes a conversation id for an OData filter", () => {
		expect(odataQuoted("AAQk'x=")).toBe("'AAQk''x='");
	});
});
