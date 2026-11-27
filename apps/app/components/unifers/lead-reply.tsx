"use client";

import { Button } from "@crm/ui/components/button";
import { FormattedText } from "@crm/ui/components/formatted-text";
import { Link as TextLink } from "@crm/ui/components/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DetailSheetSection } from "@/components/detail-sheet";
import { LocalRelativeDate } from "@/components/local-date-time";
import { repliesApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import { UNIFERS } from "@/lib/unifers/unifers-config";
import { ReplyDialog, type ReplyTarget } from "./reply-dialog";
import { WaitingBadge } from "./waiting-badge";

const TITLE = "Their latest reply";

export function LeadReply({
	email,
	name,
}: {
	email: string;
	name: string | null;
}) {
	const [replying, setReplying] = useState<ReplyTarget | null>(null);
	const replies = useQuery({
		queryKey: unifersKeys.leadReply(email.toLowerCase()),
		queryFn: () => repliesApi.fromTenant({ emails: [email], since: null }),
		refetchInterval: UNIFERS.refresh.listMs,
		retry: false,
	});

	if (replies.isPending) return null;
	if (replies.isError) {
		return (
			<DetailSheetSection title={TITLE}>
				<p className="text-destructive text-xs">{replies.error.message}</p>
			</DetailSheetSection>
		);
	}
	if (!replies.data.configured) return null;

	const reply = replies.data.replies[0];
	if (!reply) {
		return (
			<DetailSheetSection title={TITLE}>
				<p className="text-muted-foreground text-xs">
					No reply in the Unifers sending mailboxes in the last 30 days.
				</p>
			</DetailSheetSection>
		);
	}

	return (
		<DetailSheetSection title={TITLE}>
			<div className="flex flex-col gap-2">
				<WaitingBadge on={reply.waitingOn} />
				<p className="text-muted-foreground text-xs">
					<LocalRelativeDate date={reply.sentAt} /> · to {reply.mailbox}
					{reply.webLink ? (
						<>
							{" · "}
							<TextLink href={reply.webLink} target="_blank" rel="noreferrer">
								Open in Outlook
							</TextLink>
						</>
					) : null}
				</p>
				<FormattedText text={reply.text || reply.subject || "(empty)"} />
				<div>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							setReplying({
								email: reply.email,
								leadName: name,
								subject: reply.subject,
								text: reply.text,
								mailbox: reply.mailbox,
								mailboxName: reply.mailboxName,
								messageId: reply.messageId,
							})
						}
					>
						Open conversation
					</Button>
				</div>
			</div>
			<ReplyDialog target={replying} onClose={() => setReplying(null)} />
		</DetailSheetSection>
	);
}
