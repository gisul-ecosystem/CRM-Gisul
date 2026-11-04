import { describe, expect, it } from "bun:test";
import { outreachHref } from "../lib/outreach/client";
import { customKey, mappingProblem } from "../lib/outreach/contact-fields";
import {
	minuteToTime,
	timeToMinute,
	windowSummary,
} from "../lib/outreach/labels";
import { crmPathForEnginePage } from "../lib/outreach/routes";
import {
	applyFix,
	formFromCampaign,
	sendWindowProblem,
	stepProblem,
} from "../lib/outreach/wizard";

describe("outreachHref", () => {
	it("prefixes the proxy path and drops empty query values", () => {
		expect(
			outreachHref("/contacts", {
				page: 2,
				search: "",
				listId: undefined,
				status: null,
				wrongLinksOnly: true,
			}),
		).toBe("/api/outreach/contacts?page=2&wrongLinksOnly=true");
		expect(outreachHref("/dashboard/summary")).toBe(
			"/api/outreach/dashboard/summary",
		);
	});
});

describe("wizard rules", () => {
	it("asks for a name and a list on the first step", () => {
		const form = formFromCampaign();
		expect(stepProblem(0, form)).toBe("Enter a campaign name.");
		expect(stepProblem(0, { ...form, name: "Q4" })).toBe(
			"Choose a contact list.",
		);
		expect(stepProblem(0, { ...form, name: "Q4", followUpOf: "" })).toBe(
			"Choose the first campaign.",
		);
		expect(stepProblem(0, { ...form, name: "Q4", listId: "list" })).toBeNull();
	});

	it("needs a named, complete extra version", () => {
		const form = {
			...formFromCampaign(),
			subjectTemplate: "Hi",
			variants: [
				{
					name: "",
					subjectTemplate: "A",
					bodyTemplate: "B",
					bodyHtml: null,
					matchValues: [],
				},
			],
		};
		expect(stepProblem(2, form)).toBe("Give Version 2 a name.");
	});

	it("checks the send window", () => {
		expect(
			sendWindowProblem({ startMinute: 600, endMinute: 1080, days: [] }),
		).toBe("Choose at least one day.");
		expect(
			sendWindowProblem({ startMinute: 1080, endMinute: 600, days: [1] }),
		).toBe("The end time must be after the start time.");
		expect(
			sendWindowProblem({ startMinute: 600, endMinute: 1080, days: [1] }),
		).toBeNull();
	});

	it("inserts a fix above the opt-out line, or replaces a word", () => {
		const body = "Hi Lena,\n\nShort note.\n\nNot relevant? Just reply 'no'.";
		expect(
			applyFix(body, {
				kind: "insert",
				label: "Add it",
				field: "bodyTemplate",
				text: "Best,\n{{senderName}}",
				at: "before-opt-out",
			}),
		).toBe(
			"Hi Lena,\n\nShort note.\n\nBest,\n{{senderName}}\n\nNot relevant? Just reply 'no'.",
		);
		expect(
			applyFix("Act now!", {
				kind: "replace",
				label: "Use it",
				field: "subjectTemplate",
				find: "Act now",
				replace: "When suits you",
			}),
		).toBe("When suits you!");
	});
});

describe("import mapping", () => {
	it("needs exactly one email column and no repeated field", () => {
		expect(mappingProblem({ a: "firstName" })).toBe(
			"Choose exactly one column as Email.",
		);
		expect(mappingProblem({ a: "email", b: "company", c: "company" })).toBe(
			"Each field can only be chosen for one column.",
		);
		expect(
			mappingProblem({ a: "email", b: "custom", c: "custom", d: "skip" }),
		).toBeNull();
	});

	it("turns a column header into a template key", () => {
		expect(customKey("Company Size")).toBe("company_size");
		expect(customKey("2024 revenue")).toBe("f_2024_revenue");
		expect(customKey("!!!")).toBe("field");
	});
});

describe("labels and routes", () => {
	it("converts window minutes and summarises the window", () => {
		expect(minuteToTime(600)).toBe("10:00");
		expect(timeToMinute("18:30")).toBe(1110);
		expect(
			windowSummary({ startMinute: 600, endMinute: 1080, days: [1, 2, 3] }),
		).toBe("Mon, Tue, Wed · 10:00–18:00");
	});

	it("maps engine page links to CRM pages", () => {
		expect(crmPathForEnginePage("/inboxes")).toBe(
			"/outreach/setup?tab=inboxes",
		);
		expect(crmPathForEnginePage("/unknown")).toBe("/outreach");
	});
});
