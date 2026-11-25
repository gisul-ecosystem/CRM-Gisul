import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let bridge: typeof import("../lib/outreach/bridge");
const realFetch = globalThis.fetch;
let logins = 0;

beforeAll(async () => {
	process.env.OUTREACH_URL = "http://outreach.internal:3000/";
	process.env.OUTREACH_EMAIL = "service@gisul.co.in";
	process.env.OUTREACH_PASSWORD = "a-service-password";
	globalThis.fetch = Object.assign(
		async () => {
			logins += 1;
			return new Response(
				JSON.stringify({
					data: { id: "u1", email: "service@gisul.co.in", role: "admin" },
				}),
				{
					status: 200,
					headers: {
						"content-type": "application/json",
						"set-cookie":
							"outreach_session=abc.def.ghi; Path=/; HttpOnly; SameSite=Lax",
					},
				},
			);
		},
		{ preconnect: realFetch.preconnect },
	);
	bridge = await import("../lib/outreach/bridge");
});

afterAll(() => {
	globalThis.fetch = realFetch;
});

describe("outreach configuration", () => {
	it("drops the trailing slash of OUTREACH_URL and needs all three values", () => {
		expect(bridge.outreachUrl()).toBe("http://outreach.internal:3000");
		expect(bridge.outreachConfigured()).toBe(true);
	});
});

describe("outreachSession", () => {
	it("logs in once and reuses the session cookie", async () => {
		bridge.forgetOutreachSession();
		logins = 0;
		const first = await bridge.outreachSession();
		const second = await bridge.outreachSession();
		expect(first).toEqual({ ok: true, cookie: "outreach_session=abc.def.ghi" });
		expect(second).toEqual(first);
		expect(logins).toBe(1);
	});

	it("logs in again when asked for a fresh session", async () => {
		logins = 0;
		await bridge.outreachSession({ fresh: true });
		expect(logins).toBe(1);
	});
});

describe("sessionCookieFrom", () => {
	it("finds the engine cookie among several", () => {
		expect(
			bridge.sessionCookieFrom(
				"other=1; Path=/, outreach_session=tok.en; Path=/; HttpOnly",
			),
		).toBe("outreach_session=tok.en");
		expect(bridge.sessionCookieFrom("other=1")).toBeNull();
		expect(bridge.sessionCookieFrom(null)).toBeNull();
	});
});

describe("enginePath", () => {
	it("maps the CRM prefix onto the engine API", () => {
		expect(bridge.enginePath("/api/outreach/campaigns/abc/start")).toBe(
			"/api/campaigns/abc/start",
		);
	});

	it("refuses anything outside the prefix or with dot segments", () => {
		expect(bridge.enginePath("/api/other/campaigns")).toBeNull();
		expect(bridge.enginePath("/api/outreach")).toBeNull();
		expect(bridge.enginePath("/api/outreach/../auth/login")).toBeNull();
		expect(bridge.enginePath("/api/outreach/./campaigns")).toBeNull();
	});
});

describe("adminOnly", () => {
	it("guards changes to the sending setup and the mailbox directory", () => {
		expect(bridge.adminOnly("/api/providers", "POST")).toBe(true);
		expect(bridge.adminOnly("/api/inboxes/x/pause", "POST")).toBe(true);
		expect(bridge.adminOnly("/api/domains/x", "DELETE")).toBe(true);
		expect(bridge.adminOnly("/api/domains/x/mailboxes", "GET")).toBe(true);
	});

	it("lets everyone read the setup and use campaigns", () => {
		expect(bridge.adminOnly("/api/providers", "GET")).toBe(false);
		expect(bridge.adminOnly("/api/domains", "GET")).toBe(false);
		expect(bridge.adminOnly("/api/campaigns", "POST")).toBe(false);
		expect(bridge.adminOnly("/api/contacts/import/confirm", "POST")).toBe(
			false,
		);
	});
});
