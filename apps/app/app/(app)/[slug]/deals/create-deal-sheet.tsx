"use client";

import Add from "@carbon/icons-react/es/Add";
import { CURRENCIES } from "@crm/db/currency";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
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
import { dealStageLabel, OPEN_STAGES } from "@/lib/deal-stage";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const UNSET = "";

function AddButton({
	label = "New deal",
	...props
}: ComponentProps<typeof Button> & { label?: string }) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			{label}
		</Button>
	);
}

export function CreateDealSheet({
	companyId,
	triggerLabel = "New deal",
	triggerClassName,
}: {
	companyId?: string;
	triggerLabel?: string;
	triggerClassName?: string;
}) {
	return (
		<Suspense fallback={<AddButton label={triggerLabel} disabled />}>
			<CreateDealForm
				companyId={companyId}
				triggerLabel={triggerLabel}
				triggerClassName={triggerClassName}
			/>
		</Suspense>
	);
}

function CreateDealForm({
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
	const [name, setName] = useState("");
	const [company, setCompany] = useState(companyId ?? UNSET);
	const [ownerId, setOwnerId] = useState(UNSET);
	const [productId, setProductId] = useState(UNSET);
	const [stage, setStage] = useState<string>("DEMO_BOOKED");
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("");
	const [closeDate, setCloseDate] = useState("");

	const nameId = useId();
	const amountId = useId();
	const closeDateId = useId();

	const users = useQuery(trpc.users.list.queryOptions());
	const me = useQuery(trpc.users.me.queryOptions());
	const currencies = useQuery(trpc.currency.settings.queryOptions());
	const products = useQuery(trpc.products.options.queryOptions());

	const resolvedOwner = ownerId || me.data?.id || UNSET;
	const showProduct = products.data?.showInDealCreation ?? true;
	const productOptions = products.data?.options ?? [];
	const resolvedProduct =
		productId !== UNSET
			? productId
			: products.data?.defaultProductId && showProduct
				? products.data.defaultProductId
				: UNSET;
	const workspaceCurrency = currencies.data?.reportingCurrency;
	const resolvedCurrency = currency || workspaceCurrency || "USD";

	const create = useMutation(
		trpc.deals.create.mutationOptions({
			onSuccess: async (deal) => {
				await cache.deal(deal.id);
				toast.success(`${deal.name} added.`);
				await setOpen(null);
				setName("");
				setAmount("");
				setCurrency("");
				setCloseDate("");
				openRecord({ kind: "deal", id: deal.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready =
		name.trim() !== "" && company !== UNSET && resolvedOwner !== UNSET;

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
						Every deal belongs to a company and has someone's name against it.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-deal"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						const parsed = Number.parseFloat(amount);
						create.mutate({
							name,
							companyId: company,
							ownerId: resolvedOwner,
							productId:
								showProduct && resolvedProduct !== UNSET
									? resolvedProduct
									: null,
							stage: stage as never,
							amountCents: Number.isFinite(parsed)
								? Math.round(parsed * 100)
								: null,
							currency: currency || workspaceCurrency,
							expectedCloseDate: closeDate || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Stripe — Gisul"
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-deal-company">Company</FieldLabel>
							<CompanyPicker
								id="create-deal-company"
								value={company}
								onValueChange={setCompany}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-deal-owner">Owner</FieldLabel>
							<Select value={resolvedOwner} onValueChange={setOwnerId}>
								<SelectTrigger id="create-deal-owner">
									<SelectValue placeholder="Choose an owner" />
								</SelectTrigger>
								<SelectContent>
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
								<FieldLabel htmlFor="create-deal-product">Product</FieldLabel>
								<Select
									value={resolvedProduct}
									onValueChange={setProductId}
								>
									<SelectTrigger id="create-deal-product">
										<SelectValue placeholder="Select product" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={UNSET}>No product</SelectItem>
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
							<FieldLabel htmlFor="create-deal-stage">Stage</FieldLabel>
							<Select value={stage} onValueChange={setStage}>
								<SelectTrigger id="create-deal-stage">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{OPEN_STAGES.map((value) => (
										<SelectItem key={value} value={value}>
											{dealStageLabel(value)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								A new deal is an open deal — close it from the pipeline once
								there is an outcome to record.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={amountId}>Amount</FieldLabel>
							<div className="flex gap-2">
								<Input
									id={amountId}
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
									placeholder="24000"
									inputMode="decimal"
									autoComplete="off"
								/>
								<Select value={resolvedCurrency} onValueChange={setCurrency}>
									<SelectTrigger
										aria-label="Currency"
										className="w-28 shrink-0"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CURRENCIES.map((entry) => (
											<SelectItem key={entry.code} value={entry.code}>
												{entry.code}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</Field>

						<Field>
							<FieldLabel htmlFor={closeDateId}>Expected close date</FieldLabel>
							<DatePicker
								id={closeDateId}
								value={closeDate}
								onChange={setCloseDate}
								placeholder="No date yet"
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-deal"
						disabled={create.isPending || !ready}
					>
						{create.isPending ? <Spinner /> : null}
						Add deal
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
