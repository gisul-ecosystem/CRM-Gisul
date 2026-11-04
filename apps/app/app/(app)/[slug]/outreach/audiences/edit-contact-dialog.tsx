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
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
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
import { audienceApi } from "@/lib/outreach/api";
import { useOutreachCache } from "@/lib/outreach/cache";
import { CONTACT_STATUS } from "@/lib/outreach/labels";
import type { AudienceContact } from "@/lib/outreach/schemas/audience";
import {
	CONTACT_STATUSES,
	type ContactStatus,
} from "@/lib/outreach/schemas/enums";

export function EditContactDialog({
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
					<EditContactForm
						key={contact.id}
						contact={contact}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function EditContactForm({
	contact,
	onClose,
}: {
	contact: AudienceContact;
	onClose: () => void;
}) {
	const firstId = useId();
	const lastId = useId();
	const companyId = useId();
	const titleId = useId();
	const cache = useOutreachCache();
	const [firstName, setFirstName] = useState(contact.firstName);
	const [lastName, setLastName] = useState(contact.lastName);
	const [company, setCompany] = useState(contact.company);
	const [title, setTitle] = useState(contact.title);
	const [status, setStatus] = useState<ContactStatus>(contact.status);

	const save = useMutation({
		mutationFn: () =>
			audienceApi.updateContact(contact.id, {
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				company: company.trim(),
				title: title.trim(),
				status,
			}),
		onSuccess: async () => {
			await cache.audience();
			toast.success("Contact saved.");
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>Edit {contact.email}</DialogTitle>
				<DialogDescription>
					The email address cannot change. One person is one contact.
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<div className="grid grid-cols-2 gap-3">
					<Field>
						<FieldLabel htmlFor={firstId}>First name</FieldLabel>
						<Input
							id={firstId}
							value={firstName}
							onChange={(event) => setFirstName(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={lastId}>Last name</FieldLabel>
						<Input
							id={lastId}
							value={lastName}
							onChange={(event) => setLastName(event.target.value)}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor={companyId}>Company</FieldLabel>
					<Input
						id={companyId}
						value={company}
						onChange={(event) => setCompany(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={titleId}>Job title</FieldLabel>
					<Input
						id={titleId}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel>Status</FieldLabel>
					<Select
						value={status}
						onValueChange={(next) => {
							const match = CONTACT_STATUSES.find((value) => value === next);
							if (match) setStatus(match);
						}}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CONTACT_STATUSES.map((value) => (
								<SelectItem key={value} value={value}>
									{CONTACT_STATUS[value].label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>
						Unsubscribed and bounced contacts are never emailed by a campaign.
					</FieldDescription>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button disabled={save.isPending} onClick={() => save.mutate()}>
					{save.isPending ? "Saving…" : "Save"}
				</Button>
			</DialogFooter>
		</>
	);
}
