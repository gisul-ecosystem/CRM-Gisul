"use client";

import Copy from "@carbon/icons-react/es/Copy";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { audienceApi } from "@/lib/outreach/api";
import { useOutreachCache } from "@/lib/outreach/cache";
import { personName } from "@/lib/outreach/format";
import type {
	AudienceContact,
	TrackedLink,
} from "@/lib/outreach/schemas/audience";
import {
	copyRichLink,
	destinationOf,
	EMPTY_LINK_TARGET,
	type LinkTarget,
	LinkTargetFields,
	LocalLinksBanner,
	useTrackingConfig,
} from "./tracking-links";

export const DEFAULT_LINK_WORDS = "take a look at Racko";

export function CopyLinkDialog({
	contact,
	onClose,
}: {
	contact: AudienceContact | null;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={contact !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				{contact ? (
					<CopyLinkForm key={contact.id} contact={contact} onClose={onClose} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function CopyLinkForm({
	contact,
	onClose,
}: {
	contact: AudienceContact;
	onClose: () => void;
}) {
	const wordsId = useId();
	const cache = useOutreachCache();
	const config = useTrackingConfig();
	const [target, setTarget] = useState<LinkTarget>(EMPTY_LINK_TARGET);
	const [words, setWords] = useState(DEFAULT_LINK_WORDS);
	const [fresh, setFresh] = useState(false);
	const [copied, setCopied] = useState<TrackedLink | null>(null);
	const homepage = config.data?.homepage ?? "";
	const doNotEmail = contact.suppressed || contact.status !== "active";

	const create = useMutation({
		mutationFn: () =>
			audienceApi.createLink(contact.id, {
				destinationUrl: destinationOf(target.path, homepage),
				domainId: target.domainId || undefined,
				label: words.trim(),
				new: fresh,
			}),
		onSuccess: async (link) => {
			await copyRichLink(link.url, words.trim());
			await cache.audience();
			setCopied(link);
			toast.success("Link copied. Paste it into your Outlook email.");
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>Tracking link for {personName(contact)}</DialogTitle>
				<DialogDescription>
					Only paste this link into emails to {contact.email}. Their clicks
					count as theirs.
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col gap-4">
				<LocalLinksBanner />
				{doNotEmail ? (
					<Alert variant="destructive">
						<Icon icon={Warning} />
						<AlertDescription>
							This person is{" "}
							{contact.suppressed ? "on the suppression list" : contact.status}.
							They asked not to be emailed, or their address bounced.
						</AlertDescription>
					</Alert>
				) : null}
				<FieldGroup>
					<LinkTargetFields
						value={target}
						onChange={setTarget}
						config={config.data}
					/>
					<Field>
						<FieldLabel htmlFor={wordsId}>Link words</FieldLabel>
						<Input
							id={wordsId}
							value={words}
							onChange={(event) => setWords(event.target.value)}
						/>
						<FieldDescription>
							Outlook shows these words, with the link behind them.
						</FieldDescription>
					</Field>
					<Field orientation="horizontal">
						<Checkbox
							checked={fresh}
							onCheckedChange={(checked) => setFresh(checked === true)}
							aria-label="Make a new link"
						/>
						<FieldLabel>Make a new link (the old one keeps working)</FieldLabel>
					</Field>
				</FieldGroup>

				{copied ? (
					<div className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-xs">
						<span className="text-muted-foreground">Copied:</span>
						<span className="break-all font-mono">{copied.url}</span>
						<span className="text-muted-foreground">
							→ {copied.destinationUrl} · {copied.realClickCount} real click
							{copied.realClickCount === 1 ? "" : "s"} so far
						</span>
					</div>
				) : null}
			</div>

			<DialogFooter>
				<Button variant="outline" onClick={onClose}>
					Close
				</Button>
				<Button
					disabled={create.isPending || !homepage}
					onClick={() => create.mutate()}
				>
					<Icon icon={Copy} data-icon="inline-start" />
					{create.isPending ? "Copying…" : copied ? "Copy again" : "Copy link"}
				</Button>
			</DialogFooter>
		</>
	);
}
