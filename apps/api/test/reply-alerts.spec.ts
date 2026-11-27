import { describe, expect, it } from "bun:test";
import { replyAlertSettingsInput } from "@crm/validation/reply-alerts";
import {
	replyAlertHtml,
	replyAlertSubject,
} from "../src/reply-alerts/reply-alert-email";
import {
	alertRecipients,
	isIgnoredSender,
} from "../src/reply-alerts/reply-alerts.service";
import { odataQuoted } from "../src/reply-alerts/tenant-mail.client";

const content = {
	fromEmail: "asha@acme.com",
	fromName: "Asha <Rao>",
	mailbox: "johnd@getracko.in",
	subject: "Re: GPUs",
	text: "Yes, <call> me.\nTomorrow works.",
	receivedAt: new Date("2026-11-27T09:30:00.000Z"),
	crmUrl: "https://crm.example.com/acme/contacts/c1",
	outlookUrl: "https://outlook.office.com/x?a=1&b=2",
};

describe("who gets a reply alert", () => {
	it("adds the owners when asked and removes repeats", () => {
		expect(
			alertRecipients(
				{ enabled: true, owners: true, emails: ["Sales@Gisul.co.in", "x"] },
				["owner@gisul.co.in", "sales@gisul.co.in"],
			),
		).toEqual(["owner@gisul.co.in", "sales@gisul.co.in"]);
		expect(
			alertRecipients({ enabled: true, owners: false, emails: [] }, [
				"owner@gisul.co.in",
			]),
		).toEqual([]);
	});

	it("checks the added addresses", () => {
		expect(
			replyAlertSettingsInput.safeParse({
				enabled: true,
				owners: true,
				emails: ["not an email"],
			}).success,
		).toBe(false);
	});
});

describe("which senders are ignored", () => {
	const internal = new Set(["johnd@getracko.in"]);

	it("ignores our own mailboxes and bounce senders", () => {
		expect(isIgnoredSender("johnd@getracko.in", internal)).toBe(true);
		expect(isIgnoredSender("mailer-daemon@acme.com", internal)).toBe(true);
		expect(isIgnoredSender("no-reply@acme.com", internal)).toBe(true);
		expect(isIgnoredSender("", internal)).toBe(true);
	});

	it("keeps a real person and a shared sales inbox", () => {
		expect(isIgnoredSender("asha@acme.com", internal)).toBe(false);
		expect(isIgnoredSender("sales@acme.com", internal)).toBe(false);
	});
});

describe("the alert email", () => {
	it("names the lead and the topic in the subject", () => {
		expect(replyAlertSubject(content)).toBe(
			"Reply from Asha <Rao> (asha@acme.com): Re: GPUs",
		);
	});

	it("escapes the lead's text and keeps line breaks", () => {
		const html = replyAlertHtml(content);
		expect(html).toContain("Yes, &lt;call&gt; me.<br>Tomorrow works.");
		expect(html).toContain("<b>Asha &lt;Rao&gt; (asha@acme.com)</b>");
		expect(html).toContain('href="https://outlook.office.com/x?a=1&amp;b=2"');
		expect(html).toContain("27 Nov 2026, 09:30 UTC");
	});

	it("leaves out the Outlook link when there is none", () => {
		expect(replyAlertHtml({ ...content, outlookUrl: null })).not.toContain(
			"Open in Outlook",
		);
	});

	it("quotes a conversation id for an OData filter", () => {
		expect(odataQuoted("AA'Q=")).toBe("'AA''Q='");
	});
});
