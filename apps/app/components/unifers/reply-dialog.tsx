"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { FormattedText } from "@crm/ui/components/formatted-text";
import { Input } from "@crm/ui/components/input";
import { Skeleton } from "@crm/ui/components/skeleton";
import { Textarea } from "@crm/ui/components/textarea";
import { ThreadMessage } from "@crm/ui/components/thread-message";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { DATE_TIME } from "@/lib/outreach/format";
import { useTRPC } from "@/lib/trpc/client";
import { repliesApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import { mailboxFirstName, signEmail } from "@/lib/unifers/campaign-draft";
import type { ThreadEntry } from "@/lib/unifers/replies";
import { latestInbound } from "@/lib/unifers/thread";
import { UNIFERS } from "@/lib/unifers/unifers-config";

export type ReplyTarget = {
	email: string;
	leadName: string | null;
	subject: string | null;
	text: string;
	mailbox: string;
	mailboxName: string | null;
	messageId: string;
};

function savedFooter(): string {
	try {
		return window.localStorage.getItem(UNIFERS.footer.storageKey) ?? "";
	} catch {
		return "";
	}
}

export function ReplyDialog({
	target,
	onClose,
}: {
	target: ReplyTarget | null;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={target !== null}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent className="sm:max-w-lg">
				{target ? <ReplyForm target={target} /> : null}
			</DialogContent>
		</Dialog>
	);
}

function ReplyForm({ target }: { target: ReplyTarget }) {
	const ids = { body: useId(), purpose: useId() };
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const sender = mailboxFirstName(target.mailbox, target.mailboxName);
	const ending = { name: sender || null, footer: savedFooter() };
	const [body, setBody] = useState(() => signEmail("", ending));
	const [purpose, setPurpose] = useState("");

	const thread = useQuery({
		queryKey: unifersKeys.thread(target.mailbox, target.messageId),
		queryFn: () =>
			repliesApi.thread({
				mailbox: target.mailbox,
				messageId: target.messageId,
			}),
		refetchInterval: UNIFERS.refresh.listMs,
		retry: false,
	});
	const newest = latestInbound(thread.data?.messages ?? []);
	const answering = {
		messageId: newest?.id ?? target.messageId,
		subject: newest?.subject ?? target.subject,
		text: newest?.text ?? target.text,
	};

	const draft = useMutation(
		trpc.contacts.draftReply.mutationOptions({
			onSuccess: (result) => setBody(signEmail(result.body, ending)),
			onError: (error) => toast.error(error.message),
		}),
	);

	const send = useMutation({
		mutationFn: () =>
			repliesApi.send({
				mailbox: target.mailbox,
				messageId: answering.messageId,
				text: body,
			}),
		onSuccess: async () => {
			toast.success(
				`Reply sent to ${target.email} from ${target.mailbox}. It shows in the thread within a minute.`,
			);
			setBody(signEmail("", ending));
			setPurpose("");
			await queryClient.invalidateQueries({ queryKey: unifersKeys.replies });
		},
		onError: (error) => toast.error(error.message),
	});

	const busy = draft.isPending || send.isPending;

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					Conversation with {target.leadName || target.email}
				</DialogTitle>
				<DialogDescription>
					Every email in this thread, oldest first. Your reply goes from{" "}
					{target.mailbox} to their newest email, in the same thread.
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<Conversation
					target={target}
					messages={thread.data?.messages ?? null}
					loading={thread.isPending}
					error={thread.isError ? thread.error.message : null}
				/>
				<Field>
					<FieldLabel htmlFor={ids.purpose}>
						What should the reply do? (optional)
					</FieldLabel>
					<div className="flex gap-2">
						<Input
							id={ids.purpose}
							value={purpose}
							placeholder="Offer a 15-minute call on Thursday"
							onChange={(event) => setPurpose(event.target.value)}
						/>
						<Button
							variant="outline"
							disabled={busy || !answering.text.trim()}
							onClick={() =>
								draft.mutate({
									leadName: target.leadName,
									senderName: sender || null,
									subject: answering.subject,
									leadText: answering.text,
									purpose: purpose.trim() || null,
								})
							}
						>
							{draft.isPending ? "Writing…" : "Draft with AI"}
						</Button>
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.body}>Your reply</FieldLabel>
					<Textarea
						id={ids.body}
						rows={9}
						value={body}
						maxLength={UNIFERS.tenantMail.maxReplyChars}
						onChange={(event) => setBody(event.target.value)}
					/>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Close</Button>
				</DialogClose>
				<Button
					disabled={busy || body.trim() === ""}
					onClick={() => send.mutate()}
				>
					{send.isPending ? "Sending…" : "Send reply"}
				</Button>
			</DialogFooter>
		</>
	);
}

function Conversation({
	target,
	messages,
	loading,
	error,
}: {
	target: ReplyTarget;
	messages: ThreadEntry[] | null;
	loading: boolean;
	error: string | null;
}) {
	if (loading) return <Skeleton className="h-32 w-full" />;
	if (!messages || messages.length === 0) {
		return (
			<div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
				{error ? (
					<p className="text-destructive text-xs">
						Could not read the whole thread: {error}
					</p>
				) : null}
				<p className="text-muted-foreground text-xs">
					{target.subject || "Their reply"}
				</p>
				<FormattedText text={target.text || "(empty)"} />
			</div>
		);
	}
	return (
		<div className="flex max-h-80 flex-col overflow-y-auto">
			{messages.map((message) => (
				<ThreadMessage
					key={message.id}
					from={
						message.direction === "OUTBOUND"
							? (target.mailboxName ?? message.fromName ?? message.fromEmail)
							: (message.fromName ?? target.leadName ?? message.fromEmail)
					}
					fromEmail={message.fromEmail}
					direction={message.direction}
					sentAt={<LocalDateTime date={message.sentAt} options={DATE_TIME} />}
					body={message.text}
				/>
			))}
		</div>
	);
}
