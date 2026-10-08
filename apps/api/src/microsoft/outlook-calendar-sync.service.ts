import {
	ActivityType,
	type Db,
	GoogleSyncStatus,
	type MailboxSyncModel as MailboxSync,
	RecordSource,
} from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";
import {
	MailboxMatchService,
	type MatchContext,
} from "../mailbox/mailbox-match.service";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";
import { isMachineAddress, type Participant } from "../mailbox/participants";
import { SyncStateService } from "../mailbox/sync-state.service";
import {
	type GraphAttendee,
	GraphClient,
	type GraphEvent,
} from "./graph.client";

const MAX_PAGES_PER_TICK = 5;
const HORIZON_DAYS = 180;
const PAST_DAYS = 30;

export type OutlookCalendarSyncOutcome = {
	source: "outlook-calendar";
	userId: string;
	status: "synced" | "skipped" | "reconnect" | "rate-limited" | "failed";
	eventsWritten?: number;
	eventsRemoved?: number;
	reason?: string;
};

@Injectable()
export class OutlookCalendarSyncService {
	private readonly logger = new Logger(OutlookCalendarSyncService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly graph: GraphClient,
		private readonly tokens: MailboxTokenService,
		private readonly match: MailboxMatchService,
		private readonly state: SyncStateService,
		private readonly stamp: ActivityStampService,
	) {}

	async sync(row: MailboxSync): Promise<OutlookCalendarSyncOutcome> {
		const token = await this.tokens.accessTokenFor(row.userId, "outlook");

		if (token.outcome === "not-connected") {
			return {
				source: "outlook-calendar",
				userId: row.userId,
				status: "skipped",
				reason: token.reason,
			};
		}

		if (token.outcome === "needs-reconnect") {
			await this.state.markNeedsReconnect(row.id, token.reason);
			return {
				source: "outlook-calendar",
				userId: row.userId,
				status: "reconnect",
				reason: token.reason,
			};
		}

		await this.state.markRunning(row.id);

		const [internal, suppressedDomains, suppressedEmails] = await Promise.all([
			this.match.internalIdentity(),
			this.match.suppressedDomains(),
			this.match.suppressedEmails(),
		]);

		const context: MatchContext = {
			ourAddresses: internal.addresses,
			ourDomains: internal.domains,
			suppressedDomains,
			suppressedEmails,
		};

		const startDateTime = this.pastWindow().toISOString();
		const endDateTime = this.futureWindow().toISOString();

		let written = 0;
		let removed = 0;

		const result = await this.graph.listEvents(token.accessToken, {
			startDateTime,
			endDateTime,
			top: 100,
		});

		if (result.outcome !== "ok") {
			if (
				result.reason?.includes("mailbox is either inactive") ||
				result.reason?.includes("MailboxNotEnabled") ||
				result.reason?.includes("soft-deleted")
			) {
				await this.state.settle(row.id, {
					status: GoogleSyncStatus.RUNNING,
				});
				return {
					source: "outlook-calendar",
					userId: row.userId,
					status: "synced",
					eventsWritten: 0,
					eventsRemoved: 0,
					reason: "Calendar/Exchange mailbox not provisioned on Microsoft 365.",
				};
			}

			if (result.outcome === "unauthorized") {
				await this.state.markNeedsReconnect(row.id, result.reason);
				return {
					source: "outlook-calendar",
					userId: row.userId,
					status: "reconnect",
					reason: result.reason,
				};
			}

			if (result.outcome === "rate-limited") {
				await this.state.markRateLimited(row.id, result.retryAfterMs);
				return {
					source: "outlook-calendar",
					userId: row.userId,
					status: "rate-limited",
					reason: result.reason,
				};
			}

			await this.state.markFailed(row.id, result.reason);
			return {
				source: "outlook-calendar",
				userId: row.userId,
				status: "failed",
				reason: result.reason,
			};
		}

		let currentPage = result.data;
		for (let page = 0; page < MAX_PAGES_PER_TICK; page += 1) {
			for (const event of currentPage.value ?? []) {
				const applied = await this.apply(event, row, context);
				if (applied === "written") written += 1;
				if (applied === "removed") removed += 1;
			}

			const nextLink = currentPage["@odata.nextLink"];
			if (!nextLink) break;

			const nextResult = await this.graph.nextPage<typeof currentPage>(
				token.accessToken,
				nextLink,
			);
			if (nextResult.outcome !== "ok") break;
			currentPage = nextResult.data;
		}

		await this.state.settle(row.id, {
			status: GoogleSyncStatus.RUNNING,
		});

		this.logger.log({
			message: "Outlook calendar & Teams sync complete",
			userId: row.userId,
			eventsWritten: written,
			eventsRemoved: removed,
		});

		return {
			source: "outlook-calendar",
			userId: row.userId,
			status: "synced",
			eventsWritten: written,
			eventsRemoved: removed,
		};
	}

	private async apply(
		event: GraphEvent,
		row: MailboxSync,
		context: MatchContext,
	): Promise<"written" | "removed" | "ignored"> {
		const iCalUid = event.iCalUId ?? event.id;
		if (!iCalUid) return "ignored";

		const startStr = event.start?.dateTime;
		const endStr = event.end?.dateTime;
		if (!startStr || !endStr) return "ignored";

		const start = new Date(startStr);
		const end = new Date(endStr);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			return "ignored";
		}

		const key = {
			iCalUid_originalStartTime: {
				iCalUid,
				originalStartTime: start,
			},
		};

		if (event.isCancelled) {
			const deleted = await this.db.calendarEvent.deleteMany({
				where: {
					iCalUid,
					originalStartTime: start,
				},
			});
			return deleted.count > 0 ? "removed" : "ignored";
		}

		const participants = this.participantsOf(event);

		const match = await this.match.resolve(
			{
				participants,
				allowCreate: row.autoCreate,
				source: RecordSource.CALENDAR,
				ownerId: row.userId,
			},
			context,
		);

		const companyId = match?.companyId ?? null;
		const contactId = match?.contactId ?? null;

		const organizer = event.organizer?.emailAddress?.address?.toLowerCase() ?? null;
		const conferenceUrl =
			event.onlineMeeting?.joinUrl ?? event.onlineMeetingUrl ?? event.webLink ?? null;
		const location = event.location?.displayName ?? null;
		const isTeams =
			event.isOnlineMeeting ||
			event.onlineMeetingProvider === "teamsForBusiness" ||
			Boolean(conferenceUrl?.includes("teams.microsoft.com"));

		const record = await this.db.calendarEvent.upsert({
			where: key,
			create: {
				iCalUid,
				originalStartTime: start,
				recurringEventId: event.seriesMasterId ?? null,
				title: event.subject ?? null,
				description: event.bodyPreview ?? null,
				location,
				conferenceUrl,
				startsAt: start,
				endsAt: end,
				isAllDay: event.isAllDay ?? false,
				status: "confirmed",
				organizerEmail: organizer,
				companyId,
				contactId,
				syncedByUserId: row.userId,
			},
			update: {
				title: event.subject ?? null,
				description: event.bodyPreview ?? null,
				location,
				conferenceUrl,
				startsAt: start,
				endsAt: end,
				isAllDay: event.isAllDay ?? false,
				status: "confirmed",
				organizerEmail: organizer,
				companyId,
				contactId,
			},
			select: { id: true },
		});

		await this.syncAttendees(record.id, event.attendees ?? []);
		await this.project(record.id, row.userId, {
			title: event.subject ?? (isTeams ? "Teams Meeting" : "Meeting"),
			startsAt: start,
			companyId,
			contactId,
			location,
			isTeams,
		});

		return "written";
	}

	private async syncAttendees(
		eventId: string,
		attendees: GraphAttendee[],
	): Promise<void> {
		const validAttendees = attendees.filter(
			(a) =>
				a.emailAddress?.address &&
				!isMachineAddress(a.emailAddress.address.toLowerCase()),
		);

		if (validAttendees.length === 0) return;

		const emails = validAttendees.map((a) =>
			(a.emailAddress?.address as string).toLowerCase(),
		);

		const contacts = await this.db.contact.findMany({
			where: { email: { in: emails } },
			select: { id: true, email: true },
		});

		const contactByEmail = new Map(
			contacts.map((c) => [c.email as string, c.id]),
		);

		for (const attendee of validAttendees) {
			const email = (attendee.emailAddress?.address as string).toLowerCase();

			await this.db.calendarAttendee.upsert({
				where: { eventId_email: { eventId, email } },
				create: {
					eventId,
					email,
					name: attendee.emailAddress?.name ?? null,
					responseStatus: attendee.status?.response ?? null,
					isOrganizer: attendee.type === "organizer",
					contactId: contactByEmail.get(email) ?? null,
				},
				update: {
					name: attendee.emailAddress?.name ?? null,
					responseStatus: attendee.status?.response ?? null,
					isOrganizer: attendee.type === "organizer",
					contactId: contactByEmail.get(email) ?? null,
				},
			});
		}
	}

	private async project(
		calendarEventId: string,
		userId: string,
		summary: {
			title: string;
			startsAt: Date;
			companyId: string | null;
			contactId: string | null;
			location: string | null;
			isTeams: boolean;
		},
	): Promise<void> {
		const body = summary.location
			? `Location: ${summary.location}`
			: summary.isTeams
				? "Microsoft Teams Meeting"
				: null;

		const activity = await this.db.activity.upsert({
			where: { calendarEventId },
			create: {
				type: summary.isTeams ? ActivityType.CALL : ActivityType.MEETING,
				subject: summary.title,
				body,
				occurredAt: summary.startsAt,
				companyId: summary.companyId,
				contactId: summary.contactId,
				createdById: userId,
				calendarEventId,
				meta: {
					synced: true,
					source: summary.isTeams ? "teams" : "outlook",
				},
			},
			update: {
				subject: summary.title,
				body,
				occurredAt: summary.startsAt,
				companyId: summary.companyId,
				contactId: summary.contactId,
			},
			select: { createdAt: true },
		});

		await this.stamp.touch(
			{ companyId: summary.companyId, contactId: summary.contactId },
			activity.createdAt,
		);
	}

	private participantsOf(event: GraphEvent): Participant[] {
		const people: Participant[] = [];

		for (const attendee of event.attendees ?? []) {
			const address = attendee.emailAddress?.address;
			if (!address) continue;
			people.push({
				email: address.toLowerCase(),
				name: attendee.emailAddress?.name ?? null,
			});
		}

		if (event.organizer?.emailAddress?.address) {
			people.push({
				email: event.organizer.emailAddress.address.toLowerCase(),
				name: event.organizer.emailAddress.name ?? null,
			});
		}

		return people;
	}

	private pastWindow(): Date {
		const from = new Date();
		from.setDate(from.getDate() - PAST_DAYS);
		return from;
	}

	private futureWindow(): Date {
		const to = new Date();
		to.setDate(to.getDate() + HORIZON_DAYS);
		return to;
	}
}
