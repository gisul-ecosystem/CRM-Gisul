import { afterEach, describe, expect, it } from "bun:test";
import {
	pipelineUrl,
	pipelineViewerSrc,
	upstreamPath,
} from "../lib/leads-pipeline/bridge";
import { pipelineHref } from "../lib/leads-pipeline/client";
import { pipelineStatus } from "../lib/leads-pipeline/schemas";

const saved = process.env.LEADS_PIPELINE_URL;
const savedViewer = process.env.LEADS_PIPELINE_VIEWER_URL;

afterEach(() => {
	if (saved === undefined) delete process.env.LEADS_PIPELINE_URL;
	else process.env.LEADS_PIPELINE_URL = saved;
	if (savedViewer === undefined) delete process.env.LEADS_PIPELINE_VIEWER_URL;
	else process.env.LEADS_PIPELINE_VIEWER_URL = savedViewer;
});

describe("pipelineViewerSrc", () => {
	it("points noVNC's socket under the proxy path", () => {
		process.env.LEADS_PIPELINE_VIEWER_URL =
			"https://crm.example.com/leads-viewer/";
		expect(pipelineViewerSrc()).toBe(
			"https://crm.example.com/leads-viewer/vnc_lite.html?autoconnect=1&scale=true&path=leads-viewer%2Fwebsockify",
		);
	});

	it("uses the root socket for a tunnel and treats blank or junk as unset", () => {
		process.env.LEADS_PIPELINE_VIEWER_URL = "http://localhost:6082";
		expect(pipelineViewerSrc()).toBe(
			"http://localhost:6082/vnc_lite.html?autoconnect=1&scale=true&path=websockify",
		);
		process.env.LEADS_PIPELINE_VIEWER_URL = " ";
		expect(pipelineViewerSrc()).toBeNull();
		process.env.LEADS_PIPELINE_VIEWER_URL = "not a url";
		expect(pipelineViewerSrc()).toBeNull();
	});
});

describe("pipeline configuration", () => {
	it("drops trailing slashes and treats blank as unset", () => {
		process.env.LEADS_PIPELINE_URL = "http://leads-pipeline:8501/";
		expect(pipelineUrl()).toBe("http://leads-pipeline:8501");
		process.env.LEADS_PIPELINE_URL = "  ";
		expect(pipelineUrl()).toBeNull();
	});
});

describe("upstreamPath", () => {
	it("maps the CRM prefix onto the pipeline API", () => {
		expect(upstreamPath("/api/leads-pipeline/leads")).toBe("/api/leads");
	});

	it("refuses anything outside the prefix or with dot segments", () => {
		expect(upstreamPath("/api/linkedin-scraper/status")).toBeNull();
		expect(upstreamPath("/api/leads-pipeline")).toBeNull();
		expect(upstreamPath("/api/leads-pipeline/../status")).toBeNull();
		expect(upstreamPath("/api/leads-pipeline/./status")).toBeNull();
	});
});

describe("pipelineHref", () => {
	it("sends true as 1 and leaves out empty filters", () => {
		expect(
			pipelineHref("/leads", {
				profile: "gpu",
				ready: true,
				has_email: false,
				q: "",
				intent: null,
			}),
		).toBe("/api/leads-pipeline/leads?profile=gpu&ready=1");
	});
});

describe("schemas", () => {
	it("reads a status the way the pipeline sends it", () => {
		const status = pipelineStatus.parse({
			profiles: [
				{
					profile: "gpu",
					label: "GPU leads",
					noun: "startups",
					running: false,
					ours: false,
					updated: null,
					summary: {
						companies: 0,
						people: 0,
						emails: 0,
						valid: 0,
						ready: 0,
						intent: { high: 0, medium: 0, low: 0 },
					},
					lastRun: null,
					runAt: "02:00",
					batch: 200,
					maxBatch: 5000,
					sources: ["seeds"],
					dailySources: ["seeds"],
					segments: ["ai"],
					countries: ["India", "Other / unknown"],
					intents: ["high", "medium", "low"],
				},
			],
		});
		expect(status.profiles[0]?.profile).toBe("gpu");
	});
});
