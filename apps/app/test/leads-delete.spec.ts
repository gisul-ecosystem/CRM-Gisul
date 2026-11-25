import { describe, expect, it } from "bun:test";
import { adminOnly } from "../lib/leads-pipeline/bridge";

describe("lead pipeline admin-only paths", () => {
	it("keeps deleting leads to owners and admins", () => {
		expect(adminOnly("/api/leads/delete", "POST")).toBe(true);
		expect(adminOnly("/api/leads/reject", "POST")).toBe(false);
		expect(adminOnly("/api/leads", "GET")).toBe(false);
	});
});
