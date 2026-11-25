import { afterEach, describe, expect, it } from "bun:test";
import { adminOnly, unifersUrl, upstreamPath } from "../lib/unifers/bridge";
import {
	addLeadsInBatches,
	audienceLeads,
	chunks,
	leadsSummary,
} from "../lib/unifers/leads";
import { parseUnifersRouteId } from "../lib/unifers/route-id";
import {
	addLeadsResponse,
	analyticsResponse,
	campaignsResponse,
	connectAccountResponse,
	createCampaignResponse,
	emailAccountsResponse,
} from "../lib/unifers/schemas";

const realFetch = globalThis.fetch;
const savedUrl = process.env.UNIFERS_API_URL;

afterEach(() => {
	globalThis.fetch = realFetch;
	if (savedUrl === undefined) delete process.env.UNIFERS_API_URL;
	else process.env.UNIFERS_API_URL = savedUrl;
});

const CAMPAIGN = {
	id: 7,
	name: "Q4 founders outreach",
	status: "active",
	senders: ["sarah@acme.com"],
	sendWindow: {
		start: "09:00",
		end: "17:00",
		days: [1, 2, 3, 4, 5],
		timeZone: "Asia/Kolkata",
	},
	stopConditions: { onReply: true, onClick: false },
	leadCount: 120,
	scheduledStartAt: null,
	launchedAt: "2026-11-03T09:00:00Z",
	completedAt: null,
	lastError: null,
	createdAt: "2026-11-03T09:00:00Z",
	updatedAt: "2026-11-03T09:00:00Z",
};

const LEADS_RESULT = {
	received: 3,
	added: 2,
	alreadyInCampaign: 0,
	inOtherCampaign: 0,
	rejected: [{ index: 2, email: "bad@", message: "Invalid email", code: "X" }],
};

const COUNTS = {
	sent: 100,
	delivered: 97,
	opened: 40,
	clicked: 6,
	replied: 4,
	bounced: 3,
	totalOpens: 55,
	totalClicks: 7,
};

describe("bridge", () => {
	it("maps only campaigns and email accounts onto client-apis", () => {
		expect(upstreamPath("/api/unifers/campaigns")).toBe(
			"/client-apis/campaigns",
		);
		expect(upstreamPath("/api/unifers/campaigns/7/analytics")).toBe(
			"/client-apis/campaigns/7/analytics",
		);
		expect(upstreamPath("/api/unifers/email-accounts")).toBe(
			"/client-apis/email-accounts",
		);
	});

	it("blocks the paid people endpoints, dot segments and other prefixes", () => {
		expect(upstreamPath("/api/unifers/people/reveal/linkedin")).toBeNull();
		expect(upstreamPath("/api/unifers/people/search")).toBeNull();
		expect(upstreamPath("/api/unifers/campaigns/../people/search")).toBeNull();
		expect(upstreamPath("/api/outreach/campaigns")).toBeNull();
		expect(upstreamPath("/api/unifers")).toBeNull();
	});

	it("keeps sending changes for owners and admins", () => {
		expect(adminOnly("/client-apis/email-accounts", "GET", null)).toBe(false);
		expect(adminOnly("/client-apis/email-accounts", "POST", {})).toBe(true);
		expect(
			adminOnly("/client-apis/email-accounts/a%40b.com", "DELETE", null),
		).toBe(true);
		expect(adminOnly("/client-apis/campaigns/7/status", "POST", {})).toBe(true);
		expect(adminOnly("/client-apis/campaigns", "POST", { name: "x" })).toBe(
			false,
		);
		expect(
			adminOnly("/client-apis/campaigns", "POST", { startAt: "now" }),
		).toBe(true);
		expect(adminOnly("/client-apis/campaigns", "POST", { startAt: " " })).toBe(
			false,
		);
		expect(adminOnly("/client-apis/campaigns/7/leads", "POST", {})).toBe(false);
		expect(adminOnly("/client-apis/campaigns", "GET", null)).toBe(false);
	});

	it("defaults the base URL and drops trailing slashes", () => {
		delete process.env.UNIFERS_API_URL;
		expect(unifersUrl()).toBe("https://api.unifers.ai");
		process.env.UNIFERS_API_URL = "https://staging.unifers.ai/";
		expect(unifersUrl()).toBe("https://staging.unifers.ai");
	});

	it("tells Unifers campaign routes from engine ids", () => {
		expect(parseUnifersRouteId("u-42")).toBe(42);
		expect(parseUnifersRouteId("u-4x")).toBeNull();
		expect(parseUnifersRouteId("6650f1c2a3b4c5d6e7f80912")).toBeNull();
		expect(parseUnifersRouteId("u-")).toBeNull();
	});
});

describe("schemas, with the examples from the Unifers reference", () => {
	it("parses campaigns, a new campaign and added leads", () => {
		const list = campaignsResponse.parse({
			error: false,
			campaigns: [CAMPAIGN],
			total: 1,
			logId: "l",
		});
		expect(list.campaigns[0]?.status).toBe("active");
		const created = createCampaignResponse.parse({
			error: false,
			campaign: CAMPAIGN,
			leads: LEADS_RESULT,
			logId: "l",
		});
		expect(created.leads?.rejected[0]?.message).toBe("Invalid email");
		expect(
			createCampaignResponse.parse({ campaign: CAMPAIGN, leads: null }).leads,
		).toBeNull();
		expect(addLeadsResponse.parse({ leads: LEADS_RESULT }).leads.added).toBe(2);
	});

	it("keeps an unknown status from breaking the page", () => {
		expect(
			campaignsResponse.parse({
				campaigns: [{ ...CAMPAIGN, status: "warming_up" }],
				total: 1,
			}).campaigns[0]?.status,
		).toBe("draft");
	});

	it("parses analytics with a wait step", () => {
		const analytics = analyticsResponse.parse({
			campaign: CAMPAIGN,
			leads: {
				total: 120,
				enrolled: 100,
				active: 80,
				completed: 10,
				exited: 8,
				failed: 2,
				paused: 0,
			},
			email: {
				...COUNTS,
				rates: {
					deliveredPctOfSent: 97,
					bouncedPctOfSent: 3,
					openedPctOfDelivered: 41.2,
					clickedPctOfDelivered: 6.2,
					repliedPctOfDelivered: 4.1,
					opensPerOpenedEmail: 1.4,
					clicksPerClickedEmail: null,
				},
			},
			steps: [
				{
					id: "email_1",
					type: "email_send",
					subject: "Hi",
					waiting: 0,
					ended: 2,
					email: COUNTS,
				},
				{
					id: "wait_2",
					type: "wait",
					wait: "3d",
					waiting: 60,
					ended: 0,
					email: null,
				},
			],
		});
		expect(analytics.steps[1]?.email).toBeNull();
		expect(analytics.email.rates.openedPctOfDelivered).toBe(41.2);
	});

	it("parses mailboxes and both connect answers", () => {
		const accounts = emailAccountsResponse.parse({
			accounts: [
				{
					email: "sarah@acme.com",
					provider: "smtp",
					fromName: null,
					replyTo: null,
					status: "verified",
					isDefault: true,
					lastError: null,
					connectedAt: "2026-11-03T09:00:00Z",
				},
			],
		});
		expect(accounts.accounts[0]?.status).toBe("verified");
		expect(
			connectAccountResponse.parse({ authUrl: "https://accounts.google.com/x" })
				.authUrl,
		).toBe("https://accounts.google.com/x");
		expect(
			connectAccountResponse.parse({
				account: accounts.accounts[0],
				created: true,
			}).account?.email,
		).toBe("sarah@acme.com");
	});
});

describe("leads", () => {
	it("splits into calls of at most 1,000 and adds the results up", async () => {
		const sizes: number[] = [];
		globalThis.fetch = (async (_url: string, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { leads: unknown[] };
			sizes.push(body.leads.length);
			return Response.json({
				leads: {
					received: body.leads.length,
					added: body.leads.length - 1,
					alreadyInCampaign: 1,
					inOtherCampaign: 0,
					rejected: [],
				},
			});
		}) as typeof fetch;
		const leads = Array.from({ length: 2500 }, (_, i) => ({
			email: `p${i}@x.com`,
		}));
		const result = await addLeadsInBatches(7, leads, "this_campaign");
		expect(sizes).toEqual([1000, 1000, 500]);
		expect(result.added).toBe(2497);
		expect(leadsSummary(result)).toBe("2497 added · 3 already in it");
		expect(chunks([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
	});

	it("reads an audience list page by page and leaves out people who must not get mail", async () => {
		const contact = (id: number, extra: object = {}) => ({
			id: String(id),
			email: `c${id}@x.com`,
			firstName: "Asha",
			lastName: id === 1 ? "Rao" : "",
			company: id === 1 ? "LabCo" : "",
			title: "",
			custom: {},
			listIds: ["L"],
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
			createdAt: "2026-11-01T00:00:00Z",
			updatedAt: "2026-11-01T00:00:00Z",
			...extra,
		});
		const pages = [
			[contact(1), contact(2, { status: "unsubscribed" })],
			[contact(3, { suppressed: true }), contact(4, { status: "bounced" })],
			[contact(5)],
		];
		globalThis.fetch = (async (url: string) => {
			const page = Number(new URL(url, "http://x").searchParams.get("page"));
			return Response.json({
				data: pages[page - 1] ?? [],
				page,
				limit: 2,
				total: 5,
			});
		}) as typeof fetch;
		const leads = await audienceLeads("L");
		expect(leads).toEqual([
			{ email: "c1@x.com", fullName: "Asha Rao", companyName: "LabCo" },
			{ email: "c5@x.com", fullName: "Asha" },
		]);
	});
});
