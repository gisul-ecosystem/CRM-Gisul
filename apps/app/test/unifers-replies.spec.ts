import { describe, expect, it } from "bun:test";
import { unifersRepliesInput } from "@crm/validation/unifers-send";
import { campaignStart } from "../lib/unifers/replies";

describe("unifers replies", () => {
	it("reads the campaign start as an ISO time, or none", () => {
		expect(campaignStart("2026-11-25T07:15:00.000Z")).toBe(
			"2026-11-25T07:15:00.000Z",
		);
		expect(campaignStart("not a date")).toBeNull();
		expect(campaignStart(null)).toBeNull();
	});

	it("accepts the start time it builds and lowercases the emails", () => {
		const input = unifersRepliesInput.parse({
			emails: ["Nikhil@Gisul.co.in"],
			since: campaignStart("2026-11-25T07:15:00.000Z"),
		});
		expect(input.emails).toEqual(["nikhil@gisul.co.in"]);
	});
});
