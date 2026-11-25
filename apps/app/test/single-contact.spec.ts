import { describe, expect, it } from "bun:test";
import {
	type AudienceContact,
	audienceContact,
} from "../lib/outreach/schemas/audience";
import {
	columnLabel,
	listColumns,
	singleContact,
	singleContactFile,
	singleContactOutcome,
} from "../lib/outreach/single-contact";

const report = {
	total: 1,
	created: 0,
	updated: 0,
	duplicatesInFile: 0,
	invalid: 0,
	suppressed: 0,
	invalidRows: [],
	links: null,
};

const blank = {
	firstName: "",
	lastName: "",
	company: "",
	title: "",
	custom: {},
};

function member(custom: Record<string, string>): AudienceContact {
	return audienceContact.parse({
		id: Object.keys(custom).join("-") || "none",
		email: "asha@example.com",
		firstName: "Asha",
		lastName: "",
		company: "",
		title: "",
		custom,
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

describe("single audience contact", () => {
	it("needs a valid email and lowercases it", () => {
		expect(singleContact.safeParse({ ...blank, email: "nope" }).success).toBe(
			false,
		);
		expect(
			singleContact.parse({ ...blank, email: " Asha@Acme.AI " }).email,
		).toBe("asha@acme.ai");
	});

	it("takes the list's custom columns, most used first", () => {
		const columns = listColumns([
			member({ city: "Pune", linkedin_url: "x" }),
			member({ city: "Delhi" }),
			member({ email: "bad" }),
		]);
		expect(columns).toEqual(["city", "linkedin_url"]);
		expect(columnLabel("linkedin_url")).toBe("Linkedin url");
	});

	it("writes only filled cells, custom ones mapped as custom", async () => {
		const { file, mapping } = singleContactFile({
			email: "asha@acme.ai",
			firstName: "Asha",
			lastName: "",
			company: 'Acme, "AI" Labs',
			title: "",
			custom: { city: "Pune", linkedin_url: "" },
		});
		expect(await file.text()).toBe(
			'email,first_name,company,city\r\nasha@acme.ai,Asha,"Acme, ""AI"" Labs",Pune\r\n',
		);
		expect(mapping).toEqual({
			email: "email",
			first_name: "firstName",
			company: "company",
			city: "custom",
		});
	});

	it("reads the import report", () => {
		expect(singleContactOutcome({ ...report, created: 1 }).kind).toBe("added");
		expect(singleContactOutcome({ ...report, updated: 1 }).kind).toBe(
			"existing",
		);
		expect(singleContactOutcome({ ...report, suppressed: 1 }).kind).toBe(
			"suppressed",
		);
		expect(
			singleContactOutcome({
				...report,
				invalid: 1,
				invalidRows: [{ row: 1, email: "x", reason: "Bad domain" }],
			}),
		).toEqual({ kind: "invalid", reason: "Bad domain" });
	});
});
