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

export function parseGraphEventDate(
	dateTimeStr?: string | null,
	timeZone?: string | null,
): Date | null {
	if (!dateTimeStr) return null;
	const clean = dateTimeStr.trim();
	if (!clean) return null;

	// If already has trailing Z or numeric offset (+05:30, -04:00, etc.)
	if (clean.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(clean)) {
		const d = new Date(clean);
		return Number.isNaN(d.getTime()) ? null : d;
	}

	// When Prefer: outlook.timezone="UTC" is used or timeZone is UTC:
	if (!timeZone || timeZone.toUpperCase() === "UTC") {
		const d = new Date(`${clean}Z`);
		return Number.isNaN(d.getTime()) ? null : d;
	}

	// If specific timezone like "India Standard Time" or "IST":
	if (timeZone === "India Standard Time" || timeZone === "IST") {
		const d = new Date(`${clean}+05:30`);
		return Number.isNaN(d.getTime()) ? null : d;
	}

	// Fallback to UTC ISO string:
	const d = new Date(`${clean}Z`);
	if (!Number.isNaN(d.getTime())) return d;

	const fallback = new Date(clean);
	return Number.isNaN(fallback.getTime()) ? null : fallback;
}

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

		const tasksWritten = await this.syncTodoTasks(token.accessToken, row.userId);
		written += tasksWritten;

		await this.state.settle(row.id, {
			status: GoogleSyncStatus.RUNNING,
		});

		this.logger.log({
			message: "Outlook calendar, tasks & Teams sync complete",
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

	private async syncTodoTasks(accessToken: string, userId: string): Promise<number> {
		try {
			const listsRes = await this.graph.listTodoLists(accessToken);
			if (listsRes.outcome !== "ok" || !listsRes.data.value) return 0;

			let tasksWritten = 0;
			for (const list of listsRes.data.value) {
				const tasksRes = await this.graph.listTodoTasks(accessToken, list.id);
				if (tasksRes.outcome !== "ok" || !tasksRes.data.value) continue;

				for (const task of tasksRes.data.value) {
					if (!task.id || !task.title) continue;

					const dueAt = parseGraphEventDate(
						task.dueDateTime?.dateTime,
						task.dueDateTime?.timeZone,
					);
					const completedAt =
						task.status === "completed"
							? parseGraphEventDate(
									task.completedDateTime?.dateTime,
									task.completedDateTime?.timeZone,
								) ?? new Date()
							: null;
					const occurredAt =
						dueAt ?? parseGraphEventDate(task.createdDateTime) ?? new Date();

					const existing = await this.db.activity.findFirst({
						where: {
							createdById: userId,
							type: ActivityType.TASK,
							OR: [
								{ meta: { path: ["todoTaskId"], equals: task.id } },
								{ subject: task.title, dueAt: dueAt ?? undefined },
							],
						},
						select: { id: true },
					});

					if (existing) {
						await this.db.activity.update({
							where: { id: existing.id },
							data: {
								subject: task.title,
								body: task.body?.content || null,
								dueAt,
								occurredAt,
								completedAt,
								meta: { synced: true, source: "outlook-todo", todoTaskId: task.id },
							},
						});
					} else {
						await this.db.activity.create({
							data: {
								type: ActivityType.TASK,
								subject: task.title,
								body: task.body?.content || null,
								dueAt,
								occurredAt,
								completedAt,
								createdById: userId,
								meta: { synced: true, source: "outlook-todo", todoTaskId: task.id },
							},
						});
					}
					tasksWritten += 1;
				}
			}
			return tasksWritten;
		} catch (error) {
			this.logger.warn({
				message: "Microsoft To-Do sync skipped or unsupported on this account",
				error: error instanceof Error ? error.message : String(error),
			});
			return 0;
		}
	}

	private async apply(
		event: GraphEvent,
		row: MailboxSync,
		context: MatchContext,
	): Promise<"written" | "removed" | "ignored"> {
		const iCalUid = event.iCalUId ?? event.id;
		if (!iCalUid) return "ignored";

		const start = parseGraphEventDate(event.start?.dateTime, event.start?.timeZone);
		const end = parseGraphEventDate(event.end?.dateTime, event.end?.timeZone);
		if (!start || !end) {
			return "ignored";
		}

		const key = {
			iCalUid_originalStartTime: {
				iCalUid,
				originalStartTime: start,
			},
		};

		// Clean up any previously mis-synced duplicate for the same event (e.g. from prior timezone shifts)
		if (!event.seriesMasterId) {
			const staleEvents = await this.db.calendarEvent.findMany({
				where: {
					iCalUid,
					originalStartTime: { not: start },
				},
				select: { id: true },
			});

			if (staleEvents.length > 0) {
				const staleIds = staleEvents.map((e) => e.id);
				await this.db.activity.deleteMany({
					where: { calendarEventId: { in: staleIds } },
				});
				await this.db.calendarEvent.deleteMany({
					where: { id: { in: staleIds } },
				});
			}
		}

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

		const myEmail = row.mailbox?.toLowerCase();
		const hasNoExternalAttendees =
			(event.attendees ?? []).length === 0 ||
			(event.attendees ?? []).every(
				(a) => a.emailAddress?.address?.toLowerCase() === myEmail,
			);
		const titleLower = (event.subject ?? "").toLowerCase();
		const isTask =
			!isTeams &&
			(hasNoExternalAttendees ||
				titleLower.includes("task") ||
				titleLower.includes("todo") ||
				Boolean(event.isAllDay));

		await this.syncAttendees(record.id, event.attendees ?? []);
		await this.project(record.id, row.userId, {
			title: event.subject ?? (isTeams ? "Teams Meeting" : isTask ? "Task" : "Meeting"),
			startsAt: start,
			companyId,
			contactId,
			location,
			isTeams,
			isTask,
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
			isTask?: boolean;
		},
	): Promise<void> {
		const body = summary.location
			? `Location: ${summary.location}`
			: summary.isTeams
				? "Microsoft Teams Meeting"
				: null;

		const activityType = summary.isTeams
			? ActivityType.CALL
			: summary.isTask
				? ActivityType.TASK
				: ActivityType.MEETING;

		const activity = await this.db.activity.upsert({
			where: { calendarEventId },
			create: {
				type: activityType,
				subject: summary.title,
				body,
				occurredAt: summary.startsAt,
				dueAt: summary.isTask ? summary.startsAt : null,
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
				type: activityType,
				subject: summary.title,
				body,
				occurredAt: summary.startsAt,
				dueAt: summary.isTask ? summary.startsAt : null,
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
