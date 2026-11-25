import { describe, expect, it } from "bun:test";
import { ActivityType, type Db } from "@crm/db";
import { ActivitiesService } from "../src/activities/activities.service";

describe("Activities Service", () => {
	it("lists activities filtered by type and workspace context", async () => {
		const mockActivities = [
			{
				id: "act-teams-1",
				type: ActivityType.CALL,
				subject: "Client Quarterly Review (Teams)",
				body: "Microsoft Teams Meeting",
				occurredAt: new Date("2026-10-08T10:00:00Z"),
				createdAt: new Date("2026-10-08T10:00:00Z"),
				companyId: "comp-1",
				contactId: "cont-1",
				completedAt: null,
				meta: { source: "teams" },
				company: { id: "comp-1", name: "Acme Corp" },
				contact: { id: "cont-1", name: "Jane Doe", email: "jane@acme.com" },
				createdBy: { id: "user-1", name: "Sales Rep" },
			},
			{
				id: "act-meeting-2",
				type: ActivityType.MEETING,
				subject: "On-site Contract Review",
				body: "Location: Boardroom",
				occurredAt: new Date("2026-10-09T14:00:00Z"),
				createdAt: new Date("2026-10-09T14:00:00Z"),
				companyId: "comp-1",
				contactId: "cont-1",
				completedAt: new Date("2026-10-09T15:00:00Z"),
				meta: { source: "outlook" },
				company: { id: "comp-1", name: "Acme Corp" },
				contact: { id: "cont-1", name: "Jane Doe", email: "jane@acme.com" },
				createdBy: { id: "user-1", name: "Sales Rep" },
			},
		];

		const mockDb = {
			activity: {
				async findMany(args: any) {
					if (args.where?.type) {
						return mockActivities.filter((a) => a.type === args.where.type);
					}
					return mockActivities;
				},
				async count() {
					return mockActivities.length;
				},
			},
		} as unknown as Db;

		const mockStamp = {
			touch: async () => {},
		} as any;

		const service = new ActivitiesService(mockDb, mockStamp);

		// Test 1: Fetch all activities
		const resultAll = await service.list({ limit: 50 });
		expect(resultAll.length).toBe(2);
		expect(resultAll[0]?.subject).toBe("Client Quarterly Review (Teams)");
		expect(resultAll[1]?.subject).toBe("On-site Contract Review");

		// Test 2: Fetch only CALL (Teams) activities
		const resultCalls = await service.list({ type: "call", limit: 50 });
		expect(resultCalls.length).toBe(1);
		expect(resultCalls[0]?.type).toBe(ActivityType.CALL);
	});
});
