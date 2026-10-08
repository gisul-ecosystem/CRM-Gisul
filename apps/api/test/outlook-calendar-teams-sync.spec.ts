import { describe, expect, it } from "bun:test";
import {
	ActivityType,
	type Db,
	type MailboxSyncModel as MailboxSync,
	RecordSource,
} from "@crm/db";
import type { ActivityStampService } from "../src/crm/activity-stamp.service";
import type {
	MailboxMatchService,
	MatchContext,
} from "../src/mailbox/mailbox-match.service";
import type { MailboxTokenService } from "../src/mailbox/mailbox-token.service";
import type { SyncStateService } from "../src/mailbox/sync-state.service";
import type { GraphClient, GraphEvent } from "../src/microsoft/graph.client";
import { OutlookCalendarSyncService } from "../src/microsoft/outlook-calendar-sync.service";

type Ok<T> = { outcome: "ok"; data: T };

const ok = <T>(data: T): Ok<T> => ({ outcome: "ok", data });

describe("Outlook & Teams Calendar Sync Service", () => {
	const syncRow = {
		id: "sync-1",
		userId: "user-1",
		source: "outlook",
		cursor: null,
		autoCreate: true,
	} as unknown as MailboxSync;

	function createHarness(options: {
		events?: GraphEvent[];
		matchedCompanyId?: string | null;
		matchedContactId?: string | null;
	}) {
		const calendarEventsUpserted: any[] = [];
		const activitiesUpserted: any[] = [];
		const attendeesUpserted: any[] = [];
		const stampsTouched: any[] = [];

		const mockDb = {
			calendarEvent: {
				async upsert(args: any) {
					calendarEventsUpserted.push(args);
					return { id: "cal-event-123" };
				},
				async findMany() {
					return [];
				},
				async deleteMany() {
					return { count: 0 };
				},
			},
			calendarAttendee: {
				async upsert(args: any) {
					attendeesUpserted.push(args);
					return { id: "att-1" };
				},
			},
			activity: {
				async upsert(args: any) {
					activitiesUpserted.push(args);
					return { id: "act-1", createdAt: new Date() };
				},
				async deleteMany() {
					return { count: 0 };
				},
			},
			contact: {
				async findMany() {
					return [];
				},
			},
		} as unknown as Db;

		const mockGraph = {
			async listEvents() {
				return ok({
					value: options.events ?? [],
				});
			},
			async listTodoLists() {
				return ok({ value: [] });
			},
			async listTodoTasks() {
				return ok({ value: [] });
			},
			async nextPage() {
				return ok({ value: [] });
			},
		} as unknown as GraphClient;

		const mockTokens = {
			async accessTokenFor() {
				return { outcome: "ok" as const, accessToken: "mock-ms-token" };
			},
		} as unknown as MailboxTokenService;

		const mockMatch = {
			async internalIdentity() {
				return { addresses: ["rep@trycomp.ai"], domains: ["trycomp.ai"] };
			},
			async suppressedDomains() {
				return [];
			},
			async suppressedEmails() {
				return [];
			},
			async resolve() {
				return {
					companyId: options.matchedCompanyId ?? "company-101",
					contactId: options.matchedContactId ?? "contact-202",
				};
			},
		} as unknown as MailboxMatchService;

		const mockState = {
			async markRunning() {},
			async settle() {},
			async markNeedsReconnect() {},
			async markRateLimited() {},
			async markFailed() {},
		} as unknown as SyncStateService;

		const mockStamp = {
			async touch(ids: any, date: Date) {
				stampsTouched.push({ ids, date });
			},
		} as unknown as ActivityStampService;

		const service = new OutlookCalendarSyncService(
			mockDb,
			mockGraph,
			mockTokens,
			mockMatch,
			mockState,
			mockStamp,
		);

		return {
			service,
			calendarEventsUpserted,
			activitiesUpserted,
			attendeesUpserted,
			stampsTouched,
		};
	}

	it("correctly syncs a Microsoft Teams meeting and creates CALL activity", async () => {
		const teamsMeeting: GraphEvent = {
			id: "teams-event-1",
			iCalUId: "ical-teams-001",
			subject: "Sprint Planning & Sync",
			bodyPreview: "Join Microsoft Teams Meeting",
			start: { dateTime: "2026-10-08T10:00:00.000Z", timeZone: "UTC" },
			end: { dateTime: "2026-10-08T11:00:00.000Z", timeZone: "UTC" },
			isOnlineMeeting: true,
			onlineMeetingProvider: "teamsForBusiness",
			onlineMeeting: {
				joinUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz",
			},
			organizer: {
				emailAddress: { address: "colleague@trycomp.ai", name: "Colleague" },
			},
			attendees: [
				{
					emailAddress: { address: "client@acme.org", name: "Acme Client" },
					type: "required",
					status: { response: "accepted" },
				},
			],
		};

		const harness = createHarness({
			events: [teamsMeeting],
			matchedCompanyId: "comp-acme",
			matchedContactId: "cont-client",
		});

		const result = await harness.service.sync(syncRow);

		expect(result.status).toBe("synced");
		expect(result.eventsWritten).toBe(1);

		// Verify CalendarEvent creation
		expect(harness.calendarEventsUpserted.length).toBe(1);
		const createdCal = harness.calendarEventsUpserted[0].create;
		expect(createdCal.title).toBe("Sprint Planning & Sync");
		expect(createdCal.conferenceUrl).toBe("https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz");
		expect(createdCal.companyId).toBe("comp-acme");
		expect(createdCal.contactId).toBe("cont-client");

		// Verify Activity creation
		expect(harness.activitiesUpserted.length).toBe(1);
		const createdAct = harness.activitiesUpserted[0].create;
		expect(createdAct.type).toBe(ActivityType.CALL);
		expect(createdAct.subject).toBe("Sprint Planning & Sync");
		expect(createdAct.meta.source).toBe("teams");
		expect(createdAct.companyId).toBe("comp-acme");
		expect(createdAct.contactId).toBe("cont-client");
	});

	it("correctly syncs a standard Outlook in-person meeting and creates MEETING activity", async () => {
		const outlookMeeting: GraphEvent = {
			id: "outlook-event-2",
			iCalUId: "ical-outlook-002",
			subject: "Contract Review Lunch",
			bodyPreview: "Discussing Q4 agreements over lunch",
			start: { dateTime: "2026-10-09T12:30:00.000Z", timeZone: "UTC" },
			end: { dateTime: "2026-10-09T13:30:00.000Z", timeZone: "UTC" },
			location: { displayName: "Boardroom A" },
			isOnlineMeeting: false,
			organizer: {
				emailAddress: { address: "rep@trycomp.ai", name: "Sales Rep" },
			},
			attendees: [
				{
					emailAddress: { address: "ceo@acme.org", name: "Acme CEO" },
					type: "required",
				},
			],
		};

		const harness = createHarness({
			events: [outlookMeeting],
			matchedCompanyId: "comp-acme",
			matchedContactId: "cont-ceo",
		});

		const result = await harness.service.sync(syncRow);

		expect(result.status).toBe("synced");
		expect(result.eventsWritten).toBe(1);

		// Verify Activity creation
		expect(harness.activitiesUpserted.length).toBe(1);
		const createdAct = harness.activitiesUpserted[0].create;
		expect(createdAct.type).toBe(ActivityType.MEETING);
		expect(createdAct.subject).toBe("Contract Review Lunch");
		expect(createdAct.body).toContain("Location: Boardroom A");
		expect(createdAct.meta.source).toBe("outlook");
	});

	it("gracefully handles disconnected or reconnect-needed Microsoft tokens", async () => {
		const harness = createHarness({ events: [] });
		// Override token mock to simulate not connected
		(harness as any).service["tokens"] = {
			async accessTokenFor() {
				return { outcome: "not-connected" as const, reason: "No Microsoft account linked" };
			},
		};

		const result = await harness.service.sync(syncRow);
		expect(result.status).toBe("skipped");
		expect(result.reason).toBe("No Microsoft account linked");
	});

	it("correctly parses Microsoft Graph UTC and India Standard Time without timezone drift", async () => {
		const teamsMeeting: GraphEvent = {
			id: "teams-event-ist",
			iCalUId: "ical-teams-ist",
			subject: "Brain Storming",
			bodyPreview: "Brainstorming session",
			// Microsoft Graph returns 11:30 UTC when meeting is 5:00 PM IST
			start: { dateTime: "2026-10-07T11:30:00.0000000", timeZone: "UTC" },
			end: { dateTime: "2026-10-07T13:30:00.0000000", timeZone: "UTC" },
			location: { displayName: "GISUL OFFICE" },
			isOnlineMeeting: true,
			onlineMeetingProvider: "teamsForBusiness",
			onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/123" },
			organizer: {
				emailAddress: { address: "rep@trycomp.ai", name: "Sales Rep" },
			},
			attendees: [],
		};

		const harness = createHarness({
			events: [teamsMeeting],
		});

		const result = await harness.service.sync(syncRow);
		expect(result.status).toBe("synced");
		expect(harness.calendarEventsUpserted.length).toBe(1);

		const created = harness.calendarEventsUpserted[0].create;
		// 11:30 UTC = 17:00 (5:00 PM) IST
		expect(created.startsAt.toISOString()).toBe("2026-10-07T11:30:00.000Z");
		expect(created.endsAt.toISOString()).toBe("2026-10-07T13:30:00.000Z");
	});
});

