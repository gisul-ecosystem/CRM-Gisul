import { Injectable } from "@nestjs/common";
import {
	MailboxApiClient,
	type MailboxResult,
} from "../mailbox/mailbox-api.client";

const BASE = "https://graph.microsoft.com/v1.0/me";

const MESSAGE_FIELDS = [
	"id",
	"internetMessageId",
	"conversationId",
	"subject",
	"from",
	"sender",
	"toRecipients",
	"ccRecipients",
	"receivedDateTime",
	"sentDateTime",
	"body",
	"bodyPreview",
	"internetMessageHeaders",
	"parentFolderId",
	"webLink",
].join(",");

export type GraphAddress = {
	emailAddress?: { name?: string; address?: string };
};

export type GraphMessage = {
	id?: string;
	internetMessageId?: string;
	conversationId?: string;
	subject?: string | null;
	from?: GraphAddress;
	sender?: GraphAddress;
	toRecipients?: GraphAddress[];
	ccRecipients?: GraphAddress[];
	receivedDateTime?: string;
	sentDateTime?: string;
	body?: { contentType?: string; content?: string };
	bodyPreview?: string;
	internetMessageHeaders?: { name?: string; value?: string }[];
	parentFolderId?: string;
	webLink?: string;
};

export type GraphAttendee = {
	type?: string;
	status?: { response?: string };
	emailAddress?: { name?: string; address?: string };
};

export type GraphEvent = {
	id?: string;
	iCalUId?: string;
	subject?: string | null;
	bodyPreview?: string | null;
	body?: { contentType?: string; content?: string };
	start?: { dateTime?: string; timeZone?: string };
	end?: { dateTime?: string; timeZone?: string };
	isAllDay?: boolean;
	isCancelled?: boolean;
	location?: { displayName?: string };
	onlineMeeting?: { joinUrl?: string };
	onlineMeetingUrl?: string | null;
	isOnlineMeeting?: boolean;
	onlineMeetingProvider?: string;
	webLink?: string;
	organizer?: GraphAddress;
	attendees?: GraphAttendee[];
	seriesMasterId?: string | null;
};

export type EventPage = {
	value?: GraphEvent[];
	"@odata.nextLink"?: string;
};

export type MessagePage = {
	value?: GraphMessage[];
	"@odata.nextLink"?: string;
};

export type GraphUser = {
	mail?: string | null;
	userPrincipalName?: string | null;
};

export type GraphFolder = {
	id?: string;
};

const EVENT_FIELDS = [
	"id",
	"iCalUId",
	"subject",
	"bodyPreview",
	"body",
	"start",
	"end",
	"isAllDay",
	"isCancelled",
	"location",
	"onlineMeeting",
	"onlineMeetingUrl",
	"isOnlineMeeting",
	"onlineMeetingProvider",
	"webLink",
	"organizer",
	"attendees",
	"seriesMasterId",
].join(",");

@Injectable()
export class GraphClient {
	constructor(private readonly api: MailboxApiClient) {}

	async me(accessToken: string): Promise<MailboxResult<GraphUser>> {
		return this.api.get<GraphUser>(BASE, accessToken, {
			$select: "mail,userPrincipalName",
		});
	}

	async folder(
		accessToken: string,
		wellKnownName: string,
	): Promise<MailboxResult<GraphFolder>> {
		return this.api.get<GraphFolder>(
			`${BASE}/mailFolders/${wellKnownName}`,
			accessToken,
			{ $select: "id" },
		);
	}

	async listMessages(
		accessToken: string,
		options: { after: Date; top: number },
	): Promise<MailboxResult<MessagePage>> {
		return this.api.get<MessagePage>(`${BASE}/messages`, accessToken, {
			$select: MESSAGE_FIELDS,
			$filter: `receivedDateTime gt ${options.after.toISOString()} and isDraft eq false`,
			$orderby: "receivedDateTime asc",
			$top: options.top,
		});
	}

	async listEvents(
		accessToken: string,
		options: { startDateTime: string; endDateTime: string; top?: number },
	): Promise<MailboxResult<EventPage>> {
		return this.api.get<EventPage>(`${BASE}/calendarView`, accessToken, {
			$select: EVENT_FIELDS,
			startDateTime: options.startDateTime,
			endDateTime: options.endDateTime,
			$orderby: "start/dateTime asc",
			$top: options.top ?? 100,
		});
	}

	async nextPage<T = MessagePage>(
		accessToken: string,
		nextLink: string,
	): Promise<MailboxResult<T>> {
		return this.api.get<T>(nextLink, accessToken);
	}
}
