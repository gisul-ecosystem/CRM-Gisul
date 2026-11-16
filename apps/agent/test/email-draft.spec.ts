import { afterEach, describe, expect, it } from "bun:test";
import {
	emailDraftAnswer,
	emailDraftRequest,
} from "@crm/validation/email-draft";
import { draftEmail } from "../agent/lib/email-draft";

const saved = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
	if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
	else process.env.ANTHROPIC_API_KEY = saved;
});

describe("email draft", () => {
	it("reports a missing key instead of throwing", async () => {
		delete process.env.ANTHROPIC_API_KEY;
		const answer = await draftEmail({
			contactId: "c1",
			senderName: null,
			purpose: null,
		});
		expect(answer.outcome).toBe("not_configured");
	});

	it("reads a drafted answer and rejects an empty subject", () => {
		const drafted = emailDraftAnswer.parse({
			outcome: "drafted",
			draft: { subject: "Training for your team", body: "Hi Asha," },
		});
		expect(drafted.outcome).toBe("drafted");
		expect(
			emailDraftAnswer.safeParse({
				outcome: "drafted",
				draft: { subject: " ", body: "Hi" },
			}).success,
		).toBe(false);
	});

	it("needs a contact id", () => {
		expect(
			emailDraftRequest.safeParse({
				contactId: "",
				senderName: null,
				purpose: null,
			}).success,
		).toBe(false);
	});
});
