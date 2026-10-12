"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import type { ReactNode } from "react";
import { EmailThreadMessages } from "@/components/crm/timeline/email-thread-entry";
import { MeetingDetails } from "@/components/crm/timeline/meeting-details";
import { ACTIVITY_TYPE_META, type ActivityItem } from "./activities-dummy";

export type OpenActivity = {
	item: ActivityItem;
	when: string;
	status: string;
};

export function ActivityDetailSheet({
	activity,
	onClose,
}: {
	activity: OpenActivity | null;
	onClose: () => void;
}) {
	const item = activity?.item;
	const typeLabel = item ? ACTIVITY_TYPE_META[item.type].label : "";

	return (
		<Sheet
			open={activity !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent size="lg">
				<SheetHeader>
					<SheetTitle size="lg">{item?.title ?? typeLabel}</SheetTitle>
					<SheetDescription>
						{[typeLabel, activity?.when, item?.company, item?.owner]
							.filter(Boolean)
							.join(" · ")}
					</SheetDescription>
				</SheetHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
					{item && activity ? (
						<ActivityBody item={item} status={activity.status} />
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function ActivityBody({
	item,
	status,
}: {
	item: ActivityItem;
	status: string;
}) {
	if (item.threadId)
		return <EmailThreadMessages threadId={item.threadId} actions />;
	if (item.eventId) return <MeetingDetails eventId={item.eventId} />;

	return (
		<dl className="flex flex-col gap-4 text-xs">
			<Field label="Status">{status}</Field>
			{item.company ? <Field label="Related to">{item.company}</Field> : null}
			<Field label="Owner">{item.owner}</Field>
			{item.desc ? (
				<Field label="Notes">
					<p className="whitespace-pre-wrap">{item.desc}</p>
				</Field>
			) : null}
		</dl>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="text-foreground">{children}</dd>
		</div>
	);
}
