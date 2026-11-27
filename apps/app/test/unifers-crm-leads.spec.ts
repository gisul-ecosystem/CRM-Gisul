import { describe, expect, it } from "bun:test";
import { lead } from "../lib/leads-pipeline/schemas";
import { CAMPAIGN_SOURCE, crmImportsFor } from "../lib/unifers/crm-leads";

const blank = Object.fromEntries(
	Object.keys(lead.shape).map((key) => [key, ""]),
);

const found = lead.parse({
	...blank,
	company: "Irash Tech",
	domain: "irashtech.com",
	country: "India",
	segment: "it_training",
	source: "search",
	signal: "trains on cloud labs",
	signal_url: "https://irashtech.com/labs",
	date_found: "2026-11-03",
	full_name: "Rajesh Mehta",
	title: "Founder",
	linkedin_url: "https://linkedin.com/in/rajesh",
	email: "rajesh@irashtech.com",
	phone: "+91 90000 00000",
	team_size: "11-50",
});

describe("adding campaign people to the CRM", () => {
	const imports = crmImportsFor(
		[
			{ email: "Rajesh@IrashTech.com", name: "Rajesh" },
			{ email: "asha@acme.com", name: "" },
		],
		[{ profile: "training", lead: found }],
		"Opened in “Labs”",
		"COLD_OUTREACH",
	);

	it("groups people by their lead generation profile", () => {
		expect(imports.map((batch) => batch.category)).toEqual(["training", null]);
	});

	it("carries every lead generation detail and the campaign activity", () => {
		const row = imports[0]?.leads[0];
		expect(row).toMatchObject({
			fullName: "Rajesh Mehta",
			phone: "+91 90000 00000",
			title: "Founder",
			company: "Irash Tech",
			domain: "irashtech.com",
			linkedinUrl: "https://linkedin.com/in/rajesh",
		});
		expect(row?.origin).toMatchObject({
			segment: "it_training",
			country: "India",
			signal: "trains on cloud labs · Opened in “Labs”",
			source: "search",
			companySize: "11-50",
		});
		expect(row?.origin?.evidence?.[0]?.url).toBe("https://irashtech.com/labs");
	});

	it("falls back to the campaign for someone lead generation never found", () => {
		const row = imports[1]?.leads[0];
		expect(row).toMatchObject({
			fullName: "asha",
			domain: "acme.com",
			company: "",
		});
		expect(row?.origin).toMatchObject({
			signal: "Opened in “Labs”",
			source: CAMPAIGN_SOURCE,
		});
	});
});
