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
	FieldError,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import {
	columnLabel,
	listColumns,
	SINGLE_CONTACT_LIMITS,
	singleContact,
	singleContactFile,
	singleContactOutcome,
} from "@/lib/outreach/single-contact";

export type ListOption = { id: string; name: string };

export function AddContactDialog({
	open,
	lists,
	listId,
	onClose,
}: {
	open: boolean;
	lists: ListOption[];
	listId: string | null;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent>
				{open ? (
					<AddContactForm
						lists={lists}
						listId={listId ?? lists[0]?.id ?? ""}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AddContactForm({
	lists,
	listId: initialList,
	onClose,
}: {
	lists: ListOption[];
	listId: string;
	onClose: () => void;
}) {
	const ids = {
		email: useId(),
		first: useId(),
		last: useId(),
		company: useId(),
		title: useId(),
		list: useId(),
		custom: useId(),
	};
	const cache = useOutreachCache();
	const [listId, setListId] = useState(initialList);
	const [form, setForm] = useState({
		email: "",
		firstName: "",
		lastName: "",
		company: "",
		title: "",
	});
	const [custom, setCustom] = useState<Record<string, string>>({});
	const sample = useQuery({
		queryKey: [...outreachKeys.contacts, "list-columns", listId],
		queryFn: () =>
			audienceApi.contacts({
				page: 1,
				limit: SINGLE_CONTACT_LIMITS.sampleSize,
				listId,
			}),
		enabled: listId !== "",
	});
	const columns = listColumns(sample.data?.data ?? []);
	const parsed = singleContact.safeParse({
		...form,
		custom: Object.fromEntries(
			columns.map((column) => [column, custom[column] ?? ""]),
		),
	});
	const emailError =
		form.email.trim() && !parsed.success
			? parsed.error.issues.find((issue) => issue.path[0] === "email")?.message
			: undefined;
	const listName = lists.find((list) => list.id === listId)?.name ?? "the list";

	const add = useMutation({
		mutationFn: async () => {
			if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
			const { file, mapping } = singleContactFile(parsed.data);
			const report = await audienceApi.confirmImport({ file, listId, mapping });
			return {
				email: parsed.data.email,
				outcome: singleContactOutcome(report),
			};
		},
		onSuccess: async ({ email, outcome }) => {
			await cache.audience();
			if (outcome.kind === "invalid") {
				toast.error(`${email} was not added: ${outcome.reason}`);
				return;
			}
			if (outcome.kind === "suppressed") {
				toast.warning(
					`${email} is on the suppression list. Campaigns will not email it.`,
				);
			} else if (outcome.kind === "existing") {
				toast.success(
					`${email} was already a contact. Its details are updated and it is in ${listName}.`,
				);
			} else {
				toast.success(`${email} added to ${listName}.`);
			}
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	const set = (key: keyof typeof form) => (value: string) =>
		setForm((current) => ({ ...current, [key]: value }));

	return (
		<>
			<DialogHeader>
				<DialogTitle>Add a contact</DialogTitle>
				<DialogDescription>
					Adds one person to a list, with the same columns the list has. If the
					email is already a contact, the fields you fill are updated and it
					joins the list.
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={ids.list}>List</FieldLabel>
					<Select value={listId} onValueChange={setListId}>
						<SelectTrigger id={ids.list}>
							<SelectValue placeholder="Pick a list" />
						</SelectTrigger>
						<SelectContent>
							{lists.map((list) => (
								<SelectItem key={list.id} value={list.id}>
									{list.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{lists.length === 0 ? (
						<FieldDescription>
							No list yet. Create one on the Lists tab first.
						</FieldDescription>
					) : null}
				</Field>
				<Field data-invalid={emailError ? true : undefined}>
					<FieldLabel htmlFor={ids.email}>Email</FieldLabel>
					<Input
						id={ids.email}
						type="email"
						value={form.email}
						aria-invalid={emailError ? true : undefined}
						onChange={(event) => set("email")(event.target.value)}
					/>
					{emailError ? <FieldError>{emailError}</FieldError> : null}
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field>
						<FieldLabel htmlFor={ids.first}>First name</FieldLabel>
						<Input
							id={ids.first}
							value={form.firstName}
							onChange={(event) => set("firstName")(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={ids.last}>Last name</FieldLabel>
						<Input
							id={ids.last}
							value={form.lastName}
							onChange={(event) => set("lastName")(event.target.value)}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor={ids.company}>Company</FieldLabel>
					<Input
						id={ids.company}
						value={form.company}
						onChange={(event) => set("company")(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.title}>Job title</FieldLabel>
					<Input
						id={ids.title}
						value={form.title}
						onChange={(event) => set("title")(event.target.value)}
					/>
				</Field>
				{sample.isPending && listId !== "" ? (
					<FieldDescription>Reading the list's columns…</FieldDescription>
				) : columns.length > 0 ? (
					<div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
						<FieldDescription>
							{listName} also has {columns.length} custom column
							{columns.length === 1 ? "" : "s"}. Empty ones are left as they
							are.
						</FieldDescription>
						<div className="grid grid-cols-2 gap-3">
							{columns.map((column) => (
								<Field key={column}>
									<FieldLabel htmlFor={`${ids.custom}-${column}`}>
										{columnLabel(column)}
									</FieldLabel>
									<Input
										id={`${ids.custom}-${column}`}
										value={custom[column] ?? ""}
										placeholder={`{{custom.${column}}}`}
										onChange={(event) =>
											setCustom((current) => ({
												...current,
												[column]: event.target.value,
											}))
										}
									/>
								</Field>
							))}
						</div>
					</div>
				) : null}
			</FieldGroup>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button
					disabled={!parsed.success || !listId || add.isPending}
					onClick={() => add.mutate()}
				>
					{add.isPending ? "Adding…" : "Add contact"}
				</Button>
			</DialogFooter>
		</>
	);
}
