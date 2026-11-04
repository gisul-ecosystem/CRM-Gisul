"use client";

import Email from "@carbon/icons-react/es/Email";
import Reply from "@carbon/icons-react/es/Reply";
import TouchInteraction from "@carbon/icons-react/es/TouchInteraction";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Skeleton } from "@crm/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { LocalDateTime, LocalRelativeDate } from "@/components/local-date-time";
import { OutreachStatus } from "@/components/outreach/status";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { DATE_TIME, keyed, personName } from "@/lib/outreach/format";
import { CLICK_VERDICT, CONTACT_STATUS } from "@/lib/outreach/labels";
import type {
	AudienceContact,
	ContactTimelineItem,
} from "@/lib/outreach/schemas/audience";

export function ContactSheet({
	contact,
	onClose,
}: {
	contact: AudienceContact | null;
	onClose: () => void;
}) {
	return (
		<Sheet
			open={contact !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent size="md" className="overflow-y-auto">
				{contact ? <ContactSheetBody contact={contact} /> : null}
			</SheetContent>
		</Sheet>
	);
}

function ContactSheetBody({ contact }: { contact: AudienceContact }) {
	const links = useQuery({
		queryKey: [...outreachKeys.contacts, contact.id, "links"],
		queryFn: () => audienceApi.contactLinks(contact.id),
	});
	const timeline = useQuery({
		queryKey: [...outreachKeys.contacts, contact.id, "timeline"],
		queryFn: () => audienceApi.contactTimeline(contact.id),
	});
	const engagement = contact.engagement;
	const maybeBots = engagement.clickCount - engagement.realClickCount;

	return (
		<>
			<SheetHeader>
				<SheetTitle size="lg">{personName(contact)}</SheetTitle>
				<SheetDescription>
					{contact.email}
					{contact.company ? ` · ${contact.company}` : ""}
					{contact.title ? ` · ${contact.title}` : ""}
				</SheetDescription>
				<div className="pt-1">
					<OutreachStatus
						status={
							contact.suppressed
								? { label: "Suppressed", tone: "error" }
								: CONTACT_STATUS[contact.status]
						}
					/>
				</div>
			</SheetHeader>

			<div className="flex flex-col gap-5 px-4 pb-6">
				<div className="grid grid-cols-3 gap-2">
					<Stat
						label="Emailed"
						value={engagement.emailsSent}
						when={engagement.lastEmailedAt}
					/>
					<Stat
						label="Replied"
						value={engagement.replyCount}
						when={engagement.lastRepliedAt}
					/>
					<Stat
						label="Real clicks"
						value={engagement.realClickCount}
						when={engagement.lastClickedAt}
						note={maybeBots > 0 ? `+${maybeBots} bot opens` : undefined}
					/>
				</div>

				{Object.keys(contact.custom).length > 0 ? (
					<section className="flex flex-col gap-2">
						<h3 className="font-medium text-sm">Custom fields</h3>
						<dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
							{Object.entries(contact.custom).map(([key, value]) => (
								<div key={key} className="contents">
									<dt className="text-muted-foreground">{`{{custom.${key}}}`}</dt>
									<dd className="truncate">{value || "—"}</dd>
								</div>
							))}
						</dl>
					</section>
				) : null}

				<section className="flex flex-col gap-2">
					<h3 className="font-medium text-sm">Tracking links</h3>
					{links.isPending ? (
						<Skeleton className="h-10 w-full" />
					) : links.data && links.data.length > 0 ? (
						<ul className="flex flex-col gap-2 text-xs">
							{links.data.map((link) => (
								<li
									key={link.id}
									className="flex flex-col gap-0.5 rounded-lg border p-2"
								>
									<span className="break-all font-mono">{link.url}</span>
									<span className="text-muted-foreground">
										→ {link.destinationUrl} · sent {link.sentCount}× ·{" "}
										{link.realClickCount} real click
										{link.realClickCount === 1 ? "" : "s"}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-xs">
							No tracking link yet.
						</p>
					)}
				</section>

				<section className="flex flex-col gap-2">
					<h3 className="font-medium text-sm">Timeline</h3>
					{timeline.isPending ? (
						<Skeleton className="h-24 w-full" />
					) : timeline.data && timeline.data.length > 0 ? (
						<ul className="flex flex-col gap-3">
							{keyed(timeline.data, "event").map((entry) => (
								<TimelineRow key={entry.id} item={entry.item} />
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-xs">Nothing yet.</p>
					)}
				</section>
			</div>
		</>
	);
}

function Stat({
	label,
	value,
	when,
	note,
}: {
	label: string;
	value: number;
	when: string | null;
	note?: string;
}) {
	return (
		<div className="flex flex-col gap-0.5 rounded-lg border p-2 text-xs">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium text-xl tabular-nums">{value}</span>
			<span className="text-muted-foreground">
				{when ? <LocalRelativeDate date={when} /> : "—"}
			</span>
			{note ? <span className="text-muted-foreground">{note}</span> : null}
		</div>
	);
}

function TimelineRow({ item }: { item: ContactTimelineItem }) {
	const time = (
		<span className="text-muted-foreground">
			<LocalDateTime date={item.at} options={DATE_TIME} />
		</span>
	);

	if (item.type === "sent") {
		return (
			<li className="flex gap-2 text-xs">
				<Icon icon={Email} className="mt-0.5 shrink-0 text-muted-foreground" />
				<div className="flex flex-col gap-0.5">
					<span>
						Emailed:{" "}
						<span className="font-medium">
							{item.subject || "(no subject)"}
						</span>
					</span>
					<span className="text-muted-foreground">
						from {item.inboxEmail} ·{" "}
						{item.source === "manual" ? "by hand" : "by a campaign"}
					</span>
					{item.wrongLink ? (
						<span className="font-medium text-destructive">
							Contains someone else's link
						</span>
					) : null}
					{time}
				</div>
			</li>
		);
	}

	if (item.type === "replied") {
		return (
			<li className="flex gap-2 text-xs">
				<Icon icon={Reply} className="mt-0.5 shrink-0 text-success" />
				<div className="flex flex-col gap-0.5">
					<span>
						Replied{item.from ? ` (${item.from})` : ""} to{" "}
						<span className="font-medium">
							{item.subject || "(no subject)"}
						</span>
					</span>
					{time}
				</div>
			</li>
		);
	}

	return (
		<li className="flex gap-2 text-xs">
			<Icon
				icon={TouchInteraction}
				className="mt-0.5 shrink-0 text-muted-foreground"
			/>
			<div className="flex flex-col gap-0.5">
				<span className="flex flex-wrap items-center gap-2">
					Opened the link{" "}
					<OutreachStatus status={CLICK_VERDICT[item.verdict]} />
				</span>
				{item.reasons.length > 0 ? (
					<span className="text-muted-foreground">
						{item.reasons.join(" ")}
					</span>
				) : null}
				<span className="break-all text-muted-foreground">
					→ {item.destinationUrl}
				</span>
				{time}
			</div>
		</li>
	);
}
