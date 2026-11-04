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
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { campaignApi } from "@/lib/outreach/api";
import { useOutreachCache } from "@/lib/outreach/cache";

export type TestSendInbox = { id: string; email: string };

export function CampaignTestSendDialog({
	campaignId,
	inboxes,
	versionNames,
	defaultTo,
	open,
	onOpenChange,
}: {
	campaignId: string;
	inboxes: TestSendInbox[];
	versionNames: string[];
	defaultTo: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const toId = useId();
	const cache = useOutreachCache();
	const [to, setTo] = useState(defaultTo);
	const [inboxId, setInboxId] = useState<string | null>(null);
	const [version, setVersion] = useState(0);
	const from = inboxId ?? inboxes[0]?.id ?? null;

	const send = useMutation({
		mutationFn: () =>
			campaignApi.testSend(campaignId, {
				to: to.trim(),
				inboxId: from ?? undefined,
				version: versionNames.length > 1 ? version : undefined,
			}),
		onSuccess: async (result) => {
			await cache.campaigns(campaignId);
			toast.success(
				result.mode === "dry-run"
					? `Dry run: a test to ${result.to} was simulated, not sent.`
					: `Test email sent from ${result.from} to ${result.to}.`,
			);
			onOpenChange(false);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send a test to yourself</DialogTitle>
					<DialogDescription>
						The email, filled in with the first contact of the list. It counts
						as the readiness test send.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor={toId}>Send to</FieldLabel>
						<Input
							id={toId}
							type="email"
							value={to}
							onChange={(event) => setTo(event.target.value)}
							placeholder="you@company.com"
						/>
					</Field>

					{inboxes.length > 1 ? (
						<Field>
							<FieldLabel>Send from</FieldLabel>
							<Select value={from ?? undefined} onValueChange={setInboxId}>
								<SelectTrigger>
									<SelectValue placeholder="Choose an inbox" />
								</SelectTrigger>
								<SelectContent>
									{inboxes.map((inbox) => (
										<SelectItem key={inbox.id} value={inbox.id}>
											{inbox.email}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					) : null}

					{versionNames.length > 1 ? (
						<Field>
							<FieldLabel>Version</FieldLabel>
							<Select
								value={String(version)}
								onValueChange={(next) => setVersion(Number(next))}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{versionNames.map((name, index) => (
										<SelectItem key={name} value={String(index)}>
											{name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								Which version of the email to send.
							</FieldDescription>
						</Field>
					) : null}
				</div>

				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						disabled={send.isPending || !to.trim()}
						onClick={() => send.mutate()}
					>
						{send.isPending ? "Sending…" : "Send test"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
