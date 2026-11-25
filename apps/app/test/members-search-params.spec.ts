import { describe, expect, it } from "bun:test";
import { membersSearchParams } from "../app/(app)/[slug]/settings/members/members-search-params";

describe("Members & Teams Search Params", () => {
	it("parses empty search params with defaults", async () => {
		const parsed = await membersSearchParams.load({});
		expect(parsed.sort).toBe("joinedAt");
		expect(parsed.dir).toBe("asc");
		expect(parsed.role).toEqual([]);
		expect(parsed.team).toEqual([]);
		expect(parsed.status).toEqual([]);
	});

	it("parses team, role, and status filters from URL query", async () => {
		const parsed = await membersSearchParams.load({
			q: "rahul",
			role: "Sales Manager",
			team: "Sales",
			status: "active",
		});
		expect(parsed.q).toBe("rahul");
		expect(parsed.role).toEqual(["Sales Manager"]);
		expect(parsed.team).toEqual(["Sales"]);
		expect(parsed.status).toEqual(["active"]);
	});

	it("converts search params to tRPC input format", async () => {
		const parsed = await membersSearchParams.load({
			page: "2",
			pageSize: "25",
			q: "priya",
			team: ["Product", "Sales"],
		});
		const input = membersSearchParams.toInput(parsed);
		expect(input.page).toBe(2);
		expect(input.pageSize).toBe(25);
		expect(input.q).toBe("priya");
		expect(input.team).toEqual(["Product", "Sales"]);
	});
});
