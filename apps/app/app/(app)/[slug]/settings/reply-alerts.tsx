"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { DATE_TIME } from "@/lib/outreach/format";
import { useTRPC } from "@/lib/trpc/client";

function emailsFrom(text: string): string[] {
	return [
		...new Set(
			text
				.split(/[\s,;]+/)
				.map((email) => email.trim().toLowerCase())
				.filter(Boolean),
		),
	];
}

export function ReplyAlerts() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const ids = { enabled: useId(), owners: useId(), emails: useId() };
	const settings = useQuery(trpc.replyAlerts.settings.queryOptions());
	const [enabled, setEnabled] = useState(true);
	const [owners, setOwners] = useState(true);
	const [emails, setEmails] = useState("");

	useEffect(() => {
		if (!settings.data) return;
		setEnabled(settings.data.enabled);
		setOwners(settings.data.owners);
		setEmails(settings.data.emails.join("\n"));
	}, [settings.data]);

	const save = useMutation(
		trpc.replyAlerts.update.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.replyAlerts.settings.queryKey(),
				});
				toast.success("Reply alerts saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!settings.data) return null;
	const data = settings.data;
	const locked = !data.canEdit || save.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Reply alerts</CardTitle>
				<CardDescription>
					When a lead replies to a Unifers campaign or a single email, the CRM
					emails these people within about two minutes. The alert comes from the
					mailbox the lead wrote to, with their reply and a link to answer it in
					the CRM.
				</CardDescription>
				<CardAction>
					<Button
						type="submit"
						form="reply-alerts"
						disabled={locked || !data.configured}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{data.configured ? null : (
					<p className="text-muted-foreground text-xs">
						Reply alerts need UNIFERS_API_KEY and the UNIFERS_MAIL_* settings on
						the API, with the Graph permissions Mail.Read and Mail.Send.
					</p>
				)}
				{data.canEdit ? null : (
					<p className="text-muted-foreground text-xs">
						Only an owner or an admin can change reply alerts.
					</p>
				)}
				<form
					id="reply-alerts"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({ enabled, owners, emails: emailsFrom(emails) });
					}}
				>
					<FieldGroup>
						<Field orientation="horizontal">
							<Switch
								id={ids.enabled}
								checked={enabled}
								disabled={locked}
								onCheckedChange={setEnabled}
							/>
							<FieldLabel htmlFor={ids.enabled}>
								Email someone when a lead replies
							</FieldLabel>
						</Field>
						<Field orientation="horizontal">
							<Switch
								id={ids.owners}
								checked={owners}
								disabled={locked || !enabled}
								onCheckedChange={setOwners}
							/>
							<FieldLabel htmlFor={ids.owners}>
								Workspace owners ({data.ownerEmails.join(", ") || "none"})
							</FieldLabel>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.emails}>Also email</FieldLabel>
							<Textarea
								id={ids.emails}
								rows={3}
								value={emails}
								disabled={locked || !enabled}
								placeholder="sales@yourcompany.com"
								onChange={(event) => setEmails(event.target.value)}
							/>
							<FieldDescription>
								One address per line, or separated by commas.
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
				{data.recent.length > 0 ? (
					<div className="flex flex-col gap-1">
						<p className="font-medium text-xs">Latest alerts</p>
						{data.recent.map((alert) => (
							<p
								key={`${alert.mailbox}-${alert.receivedAt}-${alert.fromEmail}`}
								className={
									alert.error
										? "text-destructive text-xs"
										: "text-muted-foreground text-xs"
								}
							>
								<LocalDateTime date={alert.receivedAt} options={DATE_TIME} />
								{` · ${alert.fromEmail} → ${alert.mailbox} · `}
								{alert.error
									? `not sent: ${alert.error}`
									: alert.sentAt
										? `sent to ${alert.recipients.length}`
										: "sending"}
							</p>
						))}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
