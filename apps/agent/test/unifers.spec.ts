import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	personFrom,
	personFromUnifers,
	revealContacts,
} from "../agent/lib/unifers";

const realFetch = globalThis.fetch;
const savedKey = process.env.UNIFERS_API_KEY;
const sent: { url: string; init: RequestInit | undefined }[] = [];

function answer(status: number, body: unknown) {
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		sent.push({ url: String(url), init });
		return new Response(JSON.stringify(body), { status });
	}) as typeof fetch;
}

beforeEach(() => {
	sent.length = 0;
	process.env.UNIFERS_API_KEY = "unifers-test";
});

afterEach(() => {
	globalThis.fetch = realFetch;
	if (savedKey === undefined) delete process.env.UNIFERS_API_KEY;
	else process.env.UNIFERS_API_KEY = savedKey;
});

const profile = {
	refId: "p1",
	firstName: "Tomi",
	lastName: "Okonkwo",
	fullName: "Tomi Okonkwo",
	headline: "CTO at Acme",
	jobTitle: "CTO",
	company: { refId: "c1", name: "Acme", websiteDomain: "acme.com" },
	linkedinUrl: "https://www.linkedin.com/in/tomi",
	city: "Pune",
	country: "India",
	skills: ["gpu"],
};

describe("unifers", () => {
	it("skips without a key and calls nothing", async () => {
		delete process.env.UNIFERS_API_KEY;
		answer(200, {});
		const result = await personFromUnifers("https://www.linkedin.com/in/tomi");
		expect(result.outcome).toBe("skipped");
		expect(sent.length).toBe(0);
	});

	it("maps an enriched profile to a person with a current role", () => {
		const person = personFrom(profile, "https://www.linkedin.com/in/tomi");
		expect(person.fullName).toBe("Tomi Okonkwo");
		expect(person.location).toBe("Pune, India");
		expect(person.currentRoles[0]?.title).toBe("CTO");
		expect(person.currentRoles[0]?.organisation).toEqual({
			name: "Acme",
			domain: "acme.com",
		});
	});

	it("sends the key and the LinkedIn URL to the enrich endpoint", async () => {
		answer(200, {
			error: false,
			peopleData: profile,
			creditsCharged: 1,
			logId: "log",
		});
		const result = await personFromUnifers("https://www.linkedin.com/in/tomi");
		expect(result.outcome).toBe("found");
		expect(sent[0]?.url).toEndWith("/client-apis/people/enrich/linkedin");
		expect(new Headers(sent[0]?.init?.headers).get("X-API-Key")).toBe(
			"unifers-test",
		);
		expect(JSON.parse(String(sent[0]?.init?.body)).linkedin).toBe(
			"https://www.linkedin.com/in/tomi",
		);
	});

	it("reads a 404 as no data, not a failure", async () => {
		answer(404, {
			error: true,
			message: "No enrichment data found for this LinkedIn profile.",
			code: "PEOPLE_NOT_FOUND",
		});
		const result = await personFromUnifers("https://www.linkedin.com/in/x");
		expect(result.outcome).toBe("skipped");
	});

	it("asks to reveal only the missing fields", async () => {
		answer(200, {
			error: false,
			peopleData: {
				professionalEmails: ["tomi@acme.com"],
				personalEmails: [],
				mobiles: [],
			},
			fields: { email: "revealed" },
			creditsCharged: 1,
			logId: "log",
		});
		const call = await revealContacts("https://www.linkedin.com/in/tomi", {
			email: true,
			phone: false,
		});
		expect(JSON.parse(String(sent[0]?.init?.body)).revealContacts).toEqual({
			email: true,
			phone: false,
		});
		expect(call.outcome).toBe("ok");
	});

	it("keeps the Unifers code and message on a refused reveal", async () => {
		answer(403, {
			error: true,
			message: "Your plan does not include phone reveals.",
			code: "REVEAL_NOT_IN_PLAN",
		});
		const call = await revealContacts("https://www.linkedin.com/in/tomi", {
			email: false,
			phone: true,
		});
		expect(call).toMatchObject({
			outcome: "failed",
			status: 403,
			code: "REVEAL_NOT_IN_PLAN",
			retryable: false,
		});
	});

	it("reports an unreadable success body as an error", async () => {
		answer(200, { error: false, peopleData: {} });
		const call = await revealContacts("https://www.linkedin.com/in/tomi", {
			email: true,
			phone: true,
		});
		expect(call.outcome).toBe("failed");
	});
});
