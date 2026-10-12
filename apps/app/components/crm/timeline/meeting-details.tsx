"use client";

import Copy from "@carbon/icons-react/es/Copy";
import Email from "@carbon/icons-react/es/Email";
import Location from "@carbon/icons-react/es/Location";
import Time from "@carbon/icons-react/es/Time";
import User from "@carbon/icons-react/es/User";
import Video from "@carbon/icons-react/es/Video";
import { AttendeeRoster } from "@crm/ui/components/attendee-list";
import { Button } from "@crm/ui/components/button";
import { FormattedText } from "@crm/ui/components/formatted-text";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { Skeleton } from "@crm/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
	LocalDateTime,
	LocalDateTimeRange,
} from "@/components/local-date-time";
import { openAppOrBrowser } from "@/lib/open-app";
import { useTRPC } from "@/lib/trpc/client";

const RANGE_OPTIONS: Intl.DateTimeFormatOptions = {
	weekday: "short",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

const DAY_OPTIONS: Intl.DateTimeFormatOptions = {
	weekday: "short",
	month: "short",
	day: "numeric",
};

type CallLinks = {
	provider: string;
	app: string | null;
	web: string;
};

function callLinks(url: string): CallLinks {
	let parsed: URL | null = null;
	try {
		parsed = new URL(url);
	} catch {}

	const host = parsed?.hostname ?? "";

	if (parsed && host.endsWith("teams.microsoft.com")) {
		return {
			provider: "Teams",
			app: `msteams:${parsed.pathname}${parsed.search}${parsed.hash}`,
			web: url,
		};
	}

	if (parsed && host.endsWith("zoom.us")) {
		const meetingId = /\/j\/(\d+)/.exec(parsed.pathname)?.[1];
		const password = parsed.searchParams.get("pwd");
		return {
			provider: "Zoom",
			app: meetingId
				? `zoommtg://zoom.us/join?confno=${meetingId}${password ? `&pwd=${password}` : ""}`
				: null,
			web: url,
		};
	}

	if (host === "meet.google.com") {
		return { provider: "Google Meet", app: null, web: url };
	}

	return { provider: "the", app: null, web: url };
}

export function MeetingDetails({ eventId }: { eventId: string }) {
	const trpc = useTRPC();
	const event = useQuery(trpc.google.event.queryOptions({ eventId }));

	if (event.isPending) {
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		);
	}

	if (event.isError) {
		return (
			<p className="text-muted-foreground text-xs">{event.error.message}</p>
		);
	}

	const data = event.data;
	const conferenceUrl = data.conferenceUrl;
	const call = conferenceUrl ? callLinks(conferenceUrl) : null;
	const attendeeEmails = data.attendees
		.filter((attendee) => !attendee.isOrganizer)
		.map((attendee) => attendee.email);

	return (
		<div className="flex flex-col gap-5">
			{call || attendeeEmails.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{call ? (
						call.app ? (
							<Button
								onClick={() =>
									call.app
										? openAppOrBrowser({
												appUrl: call.app,
												webUrl: call.web,
												appName: call.provider,
											})
										: undefined
								}
							>
								<Icon icon={Video} data-icon="inline-start" />
								Join in {call.provider}
							</Button>
						) : (
							<Button asChild>
								<a href={call.web} target="_blank" rel="noreferrer">
									<Icon icon={Video} data-icon="inline-start" />
									Join {call.provider} call
								</a>
							</Button>
						)
					) : null}
					{attendeeEmails.length > 0 ? (
						<Button asChild variant="outline">
							<a
								href={`mailto:${attendeeEmails.join(",")}?subject=${encodeURIComponent(data.title ?? "")}`}
							>
								<Icon icon={Email} data-icon="inline-start" />
								Email attendees
							</a>
						</Button>
					) : null}
					{conferenceUrl ? (
						<Button
							variant="outline"
							onClick={() => {
								void navigator.clipboard
									.writeText(conferenceUrl)
									.then(() => toast.success("Call link copied."))
									.catch(() => toast.error("The link could not be copied."));
							}}
						>
							<Icon icon={Copy} data-icon="inline-start" />
							Copy link
						</Button>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-3">
				<Detail icon={Time}>
					{data.isAllDay ? (
						<>
							<LocalDateTime date={data.startsAt} options={DAY_OPTIONS} /> · All
							day
						</>
					) : (
						<LocalDateTimeRange
							start={data.startsAt}
							end={data.endsAt}
							options={RANGE_OPTIONS}
						/>
					)}
				</Detail>
				{data.location ? (
					<Detail icon={Location}>{data.location}</Detail>
				) : null}
				{data.organizerEmail ? (
					<Detail icon={User}>
						<span className="text-muted-foreground">Organized by </span>
						{data.organizerEmail}
					</Detail>
				) : null}
			</div>

			{data.attendees.length > 0 ? (
				<Section title={`Attendees · ${data.attendees.length}`}>
					<AttendeeRoster attendees={data.attendees} />
				</Section>
			) : null}

			{data.description ? (
				<Section title="Agenda">
					<div className="rounded-lg border p-3">
						<FormattedText text={data.description} html />
					</div>
				</Section>
			) : null}
		</div>
	);
}

function Detail({ icon, children }: { icon: CarbonIcon; children: ReactNode }) {
	return (
		<div className="flex items-start gap-2.5 text-xs">
			<Icon icon={icon} className="mt-0.5 shrink-0 text-muted-foreground" />
			<div className="min-w-0 text-foreground">{children}</div>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
			{children}
		</section>
	);
}
