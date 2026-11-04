import { afterEach, describe, expect, it } from "bun:test";
import {
	scraperUrl,
	scraperViewerUrl,
	upstreamPath,
} from "../lib/linkedin-scraper/bridge";
import { scrapedProfile, scraperStatus } from "../lib/linkedin-scraper/schemas";

const saved = {
	url: process.env.LINKEDIN_SCRAPER_URL,
	viewer: process.env.LINKEDIN_SCRAPER_VIEWER_URL,
};

function restore(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

afterEach(() => {
	restore("LINKEDIN_SCRAPER_URL", saved.url);
	restore("LINKEDIN_SCRAPER_VIEWER_URL", saved.viewer);
});

describe("scraper configuration", () => {
	it("drops trailing slashes and treats blank as unset", () => {
		process.env.LINKEDIN_SCRAPER_URL = "http://linkedin-scraper:6363/";
		process.env.LINKEDIN_SCRAPER_VIEWER_URL = "  ";
		expect(scraperUrl()).toBe("http://linkedin-scraper:6363");
		expect(scraperViewerUrl()).toBeNull();
	});
});

describe("upstreamPath", () => {
	it("maps the CRM prefix onto the scraper API", () => {
		expect(upstreamPath("/api/linkedin-scraper/queue/send")).toBe(
			"/api/queue/send",
		);
	});

	it("refuses anything outside the prefix or with dot segments", () => {
		expect(upstreamPath("/api/outreach/campaigns")).toBeNull();
		expect(upstreamPath("/api/linkedin-scraper")).toBeNull();
		expect(upstreamPath("/api/linkedin-scraper/../vnc/")).toBeNull();
		expect(upstreamPath("/api/linkedin-scraper/./status")).toBeNull();
	});
});

describe("schemas", () => {
	it("reads an idle status the way the scraper sends it", () => {
		const status = scraperStatus.parse({
			linkedInConnected: false,
			linkedInJob: { status: "idle" },
			scrapeJob: { status: "idle" },
			sendJob: { status: "idle" },
			sendBudget: null,
			totalProfiles: 0,
			queueCount: 0,
			user: null,
			mongo: {
				ok: true,
				uri: "mongodb://mongo:27017",
				db: "linkedin_scrapper",
			},
			inDocker: true,
			browserViewerUrl: "/vnc/vnc_lite.html?autoconnect=1&scale=true",
		});
		expect(status.scrapeJob.logs).toEqual([]);
		expect(status.sendJob.processed).toBe(0);
	});

	it("fills the fields an older profile document does not have", () => {
		const profile = scrapedProfile.parse({
			slug: "jane-doe",
			name: "Jane Doe",
			relevanceScore: null,
			queueStatus: "unknown",
		});
		expect(profile.company).toBe("");
		expect(profile.matchSignals).toEqual([]);
		expect(profile.queueStatus).toBe("scraped");
		expect(profile.messageSent).toBe(false);
	});
});
