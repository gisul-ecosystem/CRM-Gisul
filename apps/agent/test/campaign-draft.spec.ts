import { afterEach, describe, expect, it } from "bun:test";
import { campaignDraftRequest } from "@crm/validation/campaign-draft";
import {
	draftCampaign,
	keepPlaceholders,
	withoutLinks,
} from "../agent/lib/campaign-draft";

const saved = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
	if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
	else process.env.ANTHROPIC_API_KEY = saved;
});

const request = {
	productId: null,
	category: null,
	purpose: null,
	steps: 2,
	includeLink: false,
	audience: { name: null, titles: [], companies: [] },
	placeholders: ["{{firstName | there}}", "{{company.name | your team}}"],
};

describe("campaign draft", () => {
	it("reports a missing key instead of throwing", async () => {
		delete process.env.ANTHROPIC_API_KEY;
		const answer = await draftCampaign(request);
		expect(answer.outcome).toBe("not_configured");
	});

	it("keeps only the placeholders the audience has", () => {
		expect(
			keepPlaceholders(
				"Hi {{firstName}}, how is {{ company.name }} doing? {{jobTitle}} {{sender.firstName}}",
				request.placeholders,
			),
		).toBe(
			"Hi {{firstName | there}}, how is {{company.name | your team}} doing?",
		);
	});

	it("drops links when the campaign has none", () => {
		expect(
			withoutLinks("See https://racko.ai or (www.racko.ai). Worth a call?"),
		).toBe("See or. Worth a call?");
	});

	it("rejects a placeholder that is not one", () => {
		expect(
			campaignDraftRequest.safeParse({
				...request,
				placeholders: ["firstName"],
			}).success,
		).toBe(false);
		expect(
			campaignDraftRequest.safeParse({ ...request, steps: 9 }).success,
		).toBe(false);
	});
});
