"use client";

import Copy from "@carbon/icons-react/es/Copy";
import Launch from "@carbon/icons-react/es/Launch";
import Reply from "@carbon/icons-react/es/Reply";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@crm/ui/components/accordion";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Skeleton } from "@crm/ui/components/skeleton";
import { ThreadMessage } from "@crm/ui/components/thread-message";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

type Thread = RouterOutputs["google"]["thread"];

type Counterpart = { email: string; name: string | null };

export function EmailThreadEntry({
	threadId,
	messageCount,
}: {
	threadId: string;
	messageCount: number;
}) {
	const [opened, setOpened] = useState(false);

	return (
		<Accordion
			type="single"
			collapsible
			onValueChange={(value) => {
				if (value) setOpened(true);
			}}
		>
			<AccordionItem value={threadId}>
				<AccordionTrigger variant="subtle">
					{messageCount === 1 ? "1 message" : `${messageCount} messages`}
				</AccordionTrigger>

				<AccordionContent>
					<EmailThreadMessages threadId={threadId} enabled={opened} />
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

export function EmailThreadMessages({
	threadId,
	enabled = true,
	actions = false,
}: {
	threadId: string;
	enabled?: boolean;
	actions?: boolean;
}) {
	const trpc = useTRPC();

	const thread = useQuery({
		...trpc.google.thread.queryOptions({ threadId }),
		enabled,
	});

	if (thread.isPending) {
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-4 w-1/3" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		);
	}

	if (thread.isError) {
		return (
			<p className="text-muted-foreground text-xs">{thread.error.message}</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{actions ? <ThreadActions thread={thread.data} /> : null}

			<div className="flex flex-col">
				{thread.data.messages.map((message) => (
					<ThreadMessage
						key={message.id}
						from={message.fromName ?? message.fromEmail}
						fromEmail={message.fromEmail}
						fromImageUrl={message.fromImageUrl}
						sentAt={
							<LocalDateTime date={message.sentAt} options={DATE_OPTIONS} />
						}
						direction={message.direction}
						body={message.body}
						action={
							message.mailboxUrl ? (
								<Button asChild variant="ghost" size="xs">
									<a href={message.mailboxUrl} target="_blank" rel="noreferrer">
										<Icon icon={Launch} data-icon="inline-start" />
										Open in {message.mailboxName}
									</a>
								</Button>
							) : null
						}
					/>
				))}
			</div>
		</div>
	);
}

function counterpartOf(thread: Thread): Counterpart | null {
	const messages = [...thread.messages].reverse();

	const inbound = messages.find((message) => message.direction === "INBOUND");
	if (inbound) return { email: inbound.fromEmail, name: inbound.fromName };

	const recipient = messages[0]?.recipients[0];
	return recipient ? { email: recipient.email, name: recipient.name } : null;
}

function participantsOf(thread: Thread): string[] {
	const names = new Map<string, string>();
	for (const message of thread.messages) {
		const key = message.fromEmail.toLowerCase();
		if (!names.has(key)) names.set(key, message.fromName ?? message.fromEmail);
	}
	return [...names.values()];
}

function replySubject(subject: string | null): string {
	const base = subject?.trim() || "";
	return /^re:/i.test(base) ? base : `Re: ${base}`;
}

function ThreadActions({ thread }: { thread: Thread }) {
	const counterpart = counterpartOf(thread);
	const latest = thread.messages.at(-1);
	const count = thread.messages.length;
	const people = participantsOf(thread);

	return (
		<div className="flex flex-col gap-3 border-b pb-4">
			<p className="text-muted-foreground text-xs">
				{count === 1 ? "1 message" : `${count} messages`}
				{people.length > 0 ? ` · ${people.join(", ")}` : ""}
			</p>

			<div className="flex flex-wrap gap-2">
				{counterpart ? (
					<Button asChild>
						<a
							href={`mailto:${counterpart.email}?subject=${encodeURIComponent(replySubject(thread.subject))}`}
						>
							<Icon icon={Reply} data-icon="inline-start" />
							Reply to {counterpart.name ?? counterpart.email}
						</a>
					</Button>
				) : null}

				{latest?.mailboxUrl ? (
					<Button asChild variant="outline">
						<a href={latest.mailboxUrl} target="_blank" rel="noreferrer">
							<Icon icon={Launch} data-icon="inline-start" />
							Open in {latest.mailboxName}
						</a>
					</Button>
				) : null}

				{counterpart ? (
					<Button
						variant="outline"
						onClick={() => {
							void navigator.clipboard
								.writeText(counterpart.email)
								.then(() => toast.success("Email address copied."))
								.catch(() =>
									toast.error("The email address could not be copied."),
								);
						}}
					>
						<Icon icon={Copy} data-icon="inline-start" />
						Copy address
					</Button>
				) : null}
			</div>
		</div>
	);
}
