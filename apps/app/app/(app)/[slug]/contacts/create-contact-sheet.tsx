"use client";

import Add from "@carbon/icons-react/es/Add";
import { LeadStatus } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import {
	LEAD_SOURCE_OPTIONS,
	LEAD_STATUS_OPTIONS,
} from "@/lib/lead-fields";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const NONE = "none";

function AddButton({
	label = "New contact",
	...props
}: ComponentProps<typeof Button> & { label?: string }) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			{label}
		</Button>
	);
}

export function CreateContactSheet({
	companyId,
	triggerLabel = "New contact",
	triggerClassName,
}: {
	companyId?: string;
	triggerLabel?: string;
	triggerClassName?: string;
}) {
	return (
		<Suspense fallback={<AddButton label={triggerLabel} disabled />}>
			<CreateContactForm
				companyId={companyId}
				triggerLabel={triggerLabel}
				triggerClassName={triggerClassName}
			/>
		</Suspense>
	);
}

function CreateContactForm({
	companyId,
	triggerLabel,
	triggerClassName,
}: {
	companyId?: string;
	triggerLabel: string;
	triggerClassName?: string;
}) {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [title, setTitle] = useState("");
	const [company, setCompany] = useState(companyId ?? NONE);
	const [ownerId, setOwnerId] = useState(NONE);
	const [productId, setProductId] = useState(NONE);
	const [leadStatus, setLeadStatus] = useState<LeadStatus>(LeadStatus.NEW);
	const [leadSource, setLeadSource] = useState(NONE);
	const [nextFollowUpAt, setNextFollowUpAt] = useState("");

	const firstNameId = useId();
	const lastNameId = useId();
	const emailId = useId();
	const titleId = useId();
	const followUpId = useId();

	const users = useQuery(trpc.users.list.queryOptions());
	const products = useQuery(trpc.products.options.queryOptions());
	const showProduct = products.data?.showInLeadCreation ?? true;
	const productOptions = products.data?.options ?? [];
	const defaultProduct = products.data?.defaultProductId;
	const resolvedProduct =
		productId !== NONE
			? productId
			: defaultProduct && showProduct
				? defaultProduct
				: NONE;

	const create = useMutation(
		trpc.contacts.create.mutationOptions({
			onSuccess: async (contact) => {
				await cache.contact(contact.id);
				toast.success(
					`${[contact.firstName, contact.lastName].filter(Boolean).join(" ")} added.`,
				);
				await setOpen(null);
				setFirstName("");
				setLastName("");
				setEmail("");
				setTitle("");
				setLeadStatus(LeadStatus.NEW);
				setLeadSource(NONE);
				setNextFollowUpAt("");
				setProductId(NONE);
				openRecord({ kind: "contact", id: contact.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				{triggerClassName ? (
					<button type="button" className={triggerClassName}>
						<Icon icon={Add} />
						{triggerLabel}
					</button>
				) : (
					<AddButton label={triggerLabel} />
				)}
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>{triggerLabel}</SheetTitle>
					<SheetDescription>
						Email addresses are unique, so importing the same person twice
						updates them rather than duplicating them.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-contact"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							firstName,
							lastName: lastName || undefined,
							email: email || undefined,
							title: title || undefined,
							companyId: company === NONE ? null : company,
							ownerId: ownerId === NONE ? null : ownerId,
							productId:
								showProduct && resolvedProduct !== NONE
									? resolvedProduct
									: null,
							leadStatus,
							leadSource:
								leadSource === NONE
									? null
									: (leadSource as (typeof LEAD_SOURCE_OPTIONS)[number]["value"]),
							nextFollowUpAt: nextFollowUpAt || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={firstNameId}>First name</FieldLabel>
							<Input
								id={firstNameId}
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={lastNameId}>Last name</FieldLabel>
							<Input
								id={lastNameId}
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={emailId}>Email</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={titleId}>Title</FieldLabel>
							<Input
								id={titleId}
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Head of Security"
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contact-company">Company</FieldLabel>
							<CompanyPicker
								id="create-contact-company"
								value={company}
								onValueChange={setCompany}
								none={{ value: NONE, label: "No company" }}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contact-owner">Owner</FieldLabel>
							<Select value={ownerId} onValueChange={setOwnerId}>
								<SelectTrigger id="create-contact-owner">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>Unassigned</SelectItem>
									{(users.data ?? []).map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						{showProduct ? (
							<Field>
								<FieldLabel htmlFor="create-contact-product">
									Product
								</FieldLabel>
								<Select
									value={resolvedProduct}
									onValueChange={setProductId}
								>
									<SelectTrigger id="create-contact-product">
										<SelectValue placeholder="Select product" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>No product</SelectItem>
										{productOptions.map((product) => (
											<SelectItem key={product.id} value={product.id}>
												{product.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						) : null}

						<Field>
							<FieldLabel htmlFor="create-contact-status">Status</FieldLabel>
							<Select
								value={leadStatus}
								onValueChange={(value) =>
									setLeadStatus(value as LeadStatus)
								}
							>
								<SelectTrigger id="create-contact-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{LEAD_STATUS_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contact-source">Source</FieldLabel>
							<Select value={leadSource} onValueChange={setLeadSource}>
								<SelectTrigger id="create-contact-source">
									<SelectValue placeholder="Select source" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>No source</SelectItem>
									{LEAD_SOURCE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={followUpId}>Next follow-up</FieldLabel>
							<Input
								id={followUpId}
								type="date"
								value={nextFollowUpAt}
								onChange={(event) => setNextFollowUpAt(event.target.value)}
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-contact"
						disabled={create.isPending || firstName.trim() === ""}
					>
						{create.isPending ? <Spinner /> : null}
						Add contact
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
