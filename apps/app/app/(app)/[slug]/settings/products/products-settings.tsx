"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ProductMark } from "@/components/crm/product-mark";
import { AddProductSheet } from "./add-product-sheet";

type Display = RouterOutputs["products"]["display"];

export function ProductsSettings() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [q, setQ] = useState("");
	const [status, setStatus] = useState<"all" | "ACTIVE" | "INACTIVE">("all");

	const list = useQuery(
		trpc.products.list.queryOptions({ q, status, sort: "position" }),
	);
	const display = useQuery(trpc.products.display.queryOptions());

	const canManage = list.data?.canManage ?? false;
	const rows = list.data?.rows ?? [];

	return (
		<div className="flex max-w-4xl flex-col gap-6">
			{!list.isLoading && !canManage ? (
				<p className="text-sm text-muted-foreground">
					Only workspace owners and admins can add or edit products.
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				<Input
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder="Search products..."
					className="max-w-xs"
				/>
				<Select
					value={status}
					onValueChange={(value) =>
						setStatus(value as "all" | "ACTIVE" | "INACTIVE")
					}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="ACTIVE">Active</SelectItem>
						<SelectItem value="INACTIVE">Inactive</SelectItem>
					</SelectContent>
				</Select>
				<div className="ml-auto">
					<AddProductSheet canManage={canManage} />
				</div>
			</div>

			{list.isLoading ? (
				<div className="flex justify-center py-12">
					<Spinner />
				</div>
			) : rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No products yet. Add a product to start.
				</p>
			) : (
				<div className="flex flex-col gap-3">
					{rows.map((row) => (
						<Card key={row.id}>
							<CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
								<div className="flex min-w-0 items-start gap-3">
									<ProductMark
										name={row.name}
										color={row.color}
										iconUrl={row.iconUrl}
										className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold"
									/>
									<div className="min-w-0">
										<CardTitle className="truncate text-base">
											{row.name}
										</CardTitle>
										<CardDescription className="mt-1">
											{row.shortDescription}
										</CardDescription>
										<div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
											<span
												className={
													row.status === "ACTIVE"
														? "text-emerald-700"
														: "text-muted-foreground"
												}
											>
												{row.status === "ACTIVE" ? "Active" : "Inactive"}
											</span>
											{row.isCore ? (
												<span className="rounded-full bg-muted px-2 py-0.5">
													{row.category || "Core Product"}
												</span>
											) : null}
											<span>
												{formatCount(row.counts.leads, "Lead")} ·{" "}
												{formatCount(row.counts.deals, "Deal")} ·{" "}
												{formatCount(row.counts.customers, "Customer")}
											</span>
										</div>
									</div>
								</div>
								<AddProductSheet canManage={canManage} product={row} />
							</CardHeader>
						</Card>
					))}
				</div>
			)}

			{display.data ? (
				<DisplaySettings
					key={`${display.dataUpdatedAt}`}
					initial={display.data}
					canManage={canManage}
					activeOptions={rows.filter((row) => row.status === "ACTIVE")}
					onSaved={() =>
						queryClient.invalidateQueries({
							queryKey: trpc.products.pathKey(),
						})
					}
				/>
			) : (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			)}
		</div>
	);
}

function DisplaySettings({
	initial,
	canManage,
	activeOptions,
	onSaved,
}: {
	initial: Display;
	canManage: boolean;
	activeOptions: { id: string; name: string }[];
	onSaved: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [showInLeadCreation, setShowInLeadCreation] = useState(
		initial.showInLeadCreation,
	);
	const [showInCustomerCreation, setShowInCustomerCreation] = useState(
		initial.showInCustomerCreation,
	);
	const [showInDealCreation, setShowInDealCreation] = useState(
		initial.showInDealCreation,
	);
	const [defaultProductId, setDefaultProductId] = useState<string | null>(
		initial.defaultProductId,
	);
	const [allowMultipleOnDeal, setAllowMultipleOnDeal] = useState(
		initial.allowMultipleOnDeal,
	);

	const saveDisplay = useMutation(
		trpc.products.updateDisplay.mutationOptions({
			onSuccess: async () => {
				await onSaved();
				toast.success("Product display settings saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Product display settings</CardTitle>
				<CardDescription>
					Control where products appear when people create records.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<div className="flex flex-col gap-3">
					<FieldLabel>Show products in</FieldLabel>
					<label className="flex items-center gap-2 text-sm">
						<Checkbox
							checked={showInLeadCreation}
							onCheckedChange={(checked) =>
								setShowInLeadCreation(checked === true)
							}
							disabled={!canManage}
						/>
						Lead creation
					</label>
					<label className="flex items-center gap-2 text-sm">
						<Checkbox
							checked={showInCustomerCreation}
							onCheckedChange={(checked) =>
								setShowInCustomerCreation(checked === true)
							}
							disabled={!canManage}
						/>
						Customer creation
					</label>
					<label className="flex items-center gap-2 text-sm">
						<Checkbox
							checked={showInDealCreation}
							onCheckedChange={(checked) =>
								setShowInDealCreation(checked === true)
							}
							disabled={!canManage}
						/>
						Deal creation
					</label>
				</div>

				<Field>
					<FieldLabel>Set default product</FieldLabel>
					<Select
						value={defaultProductId ?? "none"}
						onValueChange={(value) =>
							setDefaultProductId(value === "none" ? null : value)
						}
						disabled={!canManage}
					>
						<SelectTrigger>
							<SelectValue placeholder="No default" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No default</SelectItem>
							{activeOptions.map((row) => (
								<SelectItem key={row.id} value={row.id}>
									{row.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>
						This product will be pre-selected when creating new leads or deals.
					</FieldDescription>
				</Field>

				<div className="flex items-start justify-between gap-4">
					<div>
						<FieldLabel>Allow multiple products per deal</FieldLabel>
						<FieldDescription>
							Enable selection of multiple products in a single deal. Deals
							still store one product for now.
						</FieldDescription>
					</div>
					<Switch
						checked={allowMultipleOnDeal}
						onCheckedChange={setAllowMultipleOnDeal}
						disabled={!canManage}
					/>
				</div>

				<div>
					<Button
						disabled={!canManage || saveDisplay.isPending}
						onClick={() =>
							saveDisplay.mutate({
								showInLeadCreation,
								showInCustomerCreation,
								showInDealCreation,
								defaultProductId,
								allowMultipleOnDeal,
							})
						}
					>
						{saveDisplay.isPending ? (
							<Spinner data-icon="inline-start" />
						) : null}
						Save changes
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
