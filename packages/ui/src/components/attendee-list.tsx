import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	type StatusTone,
	StatusIndicator,
} from "@crm/ui/components/status-indicator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import type * as React from "react";

export type Attendee = {
	id: string;
	email: string;
	name: string | null;
	responseStatus: string | null;
	isOrganizer: boolean;
	imageUrl?: string | null;
};

const RESPONSE_TONE: Record<string, StatusTone> = {
	accepted: "success",
	organizer: "success",
	declined: "error",
	tentative: "warning",
	tentativelyAccepted: "warning",
	needsAction: "neutral",
	notResponded: "neutral",
	none: "neutral",
};

const RESPONSE_LABEL: Record<string, string> = {
	accepted: "Accepted",
	organizer: "Organizer",
	declined: "Declined",
	tentative: "Maybe",
	tentativelyAccepted: "Maybe",
	needsAction: "No reply",
	notResponded: "No reply",
	none: "No reply",
};

function attendeeResponse(status: string | null): {
	tone: StatusTone;
	label: string;
} {
	const key = status ?? "needsAction";
	return {
		tone: RESPONSE_TONE[key] ?? "neutral",
		label: RESPONSE_LABEL[key] ?? "No reply",
	};
}

function displayName(attendee: Attendee): string | null {
	return attendee.name?.trim() && !attendee.name.includes("@")
		? attendee.name
		: null;
}

function AttendeeList({
	attendees,
	max = 5,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	attendees: readonly Attendee[];
	max?: number;
}) {
	if (attendees.length === 0) return null;

	const shown = attendees.slice(0, max);
	const overflow = attendees.length - shown.length;

	return (
		<div
			data-slot="attendee-list"
			className={cn("flex items-center gap-2", className)}
			{...props}
		>
			<div className="flex items-center gap-1">
				{shown.map((attendee) => (
					<Tooltip key={attendee.id}>
						<TooltipTrigger asChild>
							<PersonAvatar
								src={attendee.imageUrl}
								name={displayName(attendee)}
								email={attendee.email}
								size="sm"
							/>
						</TooltipTrigger>
						<TooltipContent>
							<span className="flex items-center gap-2">
								{attendee.name ?? attendee.email}
								<StatusIndicator {...attendeeResponse(attendee.responseStatus)} />
							</span>
						</TooltipContent>
					</Tooltip>
				))}
			</div>

			{overflow > 0 ? (
				<span className="text-muted-foreground text-xs">+{overflow}</span>
			) : null}
		</div>
	);
}

function AttendeeRoster({
	attendees,
	className,
	...props
}: Omit<React.ComponentProps<"ul">, "children"> & {
	attendees: readonly Attendee[];
}) {
	if (attendees.length === 0) return null;

	return (
		<ul
			data-slot="attendee-roster"
			className={cn("flex flex-col divide-y rounded-lg border", className)}
			{...props}
		>
			{attendees.map((attendee) => {
				const name = displayName(attendee);
				return (
					<li
						key={attendee.id}
						className="flex min-w-0 items-center gap-2.5 px-3 py-2"
					>
						<PersonAvatar
							src={attendee.imageUrl}
							name={name}
							email={attendee.email}
							size="sm"
						/>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate font-medium text-xs">
								{name ?? attendee.email}
							</span>
							{name ? (
								<span className="truncate text-muted-foreground text-xs">
									{attendee.email}
								</span>
							) : null}
						</div>
						<StatusIndicator
							{...(attendee.isOrganizer
								? attendeeResponse("organizer")
								: attendeeResponse(attendee.responseStatus))}
						/>
					</li>
				);
			})}
		</ul>
	);
}

export { AttendeeList, AttendeeRoster };
