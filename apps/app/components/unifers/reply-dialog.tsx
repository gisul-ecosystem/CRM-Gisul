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
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { repliesApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import { mailboxFirstName, signEmail } from "@/lib/unifers/campaign-draft";
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
			<DialogContent>
				{target ? <ReplyForm target={target} onClose={onClose} /> : null}
			</DialogContent>
		</Dialog>
	);
}

function ReplyForm({
	target,
	onClose,
}: {
	target: ReplyTarget;
	onClose: () => void;
}) {
	const ids = { body: useId(), purpose: useId() };
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const sender = mailboxFirstName(target.mailbox, target.mailboxName);
	const ending = { name: sender || null, footer: savedFooter() };
	const [body, setBody] = useState(() => signEmail("", ending));
	const [purpose, setPurpose] = useState("");

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
				messageId: target.messageId,
				text: body,
			}),
		onSuccess: async () => {
			toast.success(`Reply sent to ${target.email} from ${target.mailbox}.`);
			await queryClient.invalidateQueries({ queryKey: unifersKeys.replies });
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	const busy = draft.isPending || send.isPending;

	return (
		<>
			<DialogHeader>
				<DialogTitle>Reply to {target.leadName || target.email}</DialogTitle>
				<DialogDescription>
					Sent from {target.mailbox} in the same thread, with their email quoted
					below yours.
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
					<p className="text-muted-foreground text-xs">
						{target.subject || "Their reply"}
					</p>
					<FormattedText text={target.text || "(empty)"} />
				</div>
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
							disabled={busy || !target.text.trim()}
							onClick={() =>
								draft.mutate({
									leadName: target.leadName,
									senderName: sender || null,
									subject: target.subject,
									leadText: target.text,
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
					<Button variant="outline">Cancel</Button>
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
