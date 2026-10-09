"use client";

import Add from "@carbon/icons-react/es/Add";
import Copy from "@carbon/icons-react/es/Copy";
import Edit from "@carbon/icons-react/es/Edit";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Search from "@carbon/icons-react/es/Search";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
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
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ProductMark } from "@/components/crm/product-mark";
import { AddProductSheet } from "./add-product-sheet";

type Display = RouterOutputs["products"]["display"];
type ProductRow = RouterOutputs["products"]["list"]["rows"][number];

export function ProductsSettings() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [q, setQ] = useState("");
	const [status, setStatus] = useState<"all" | "ACTIVE" | "INACTIVE">("all");
	const [sortBy, setSortBy] = useState<"name" | "leads" | "deals" | "customers" | "createdAt">("name");

	const list = useQuery(
		trpc.products.list.queryOptions({ q, status, sort: "position" }),
	);
	const display = useQuery(trpc.products.display.queryOptions());

	const canManage = list.data?.canManage ?? false;
	const rows = list.data?.rows ?? [];

	const invalidateProducts = () =>
		queryClient.invalidateQueries({ queryKey: trpc.products.pathKey() });

	const toggleStatusMutation = useMutation(
		trpc.products.update.mutationOptions({
			onSuccess: (_, variables) => {
				invalidateProducts();
				toast.success(`Product marked as ${variables.status?.toLowerCase()}.`);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const duplicateMutation = useMutation(
		trpc.products.create.mutationOptions({
			onSuccess: (res) => {
				invalidateProducts();
				toast.success(`${res.name} created as duplicate.`);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const archiveMutation = useMutation(
		trpc.products.archive.mutationOptions({
			onSuccess: () => {
				invalidateProducts();
				toast.success("Product deleted successfully.");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const sortedRows = useMemo(() => {
		const items = [...rows];
		if (sortBy === "name") {
			return items.sort((a, b) => a.name.localeCompare(b.name));
		}
		if (sortBy === "leads") {
			return items.sort((a, b) => b.counts.leads - a.counts.leads);
		}
		if (sortBy === "deals") {
			return items.sort((a, b) => b.counts.deals - a.counts.deals);
		}
		if (sortBy === "customers") {
			return items.sort((a, b) => b.counts.customers - a.counts.customers);
		}
		if (sortBy === "createdAt") {
			return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		}
		return items;
	}, [rows, sortBy]);

	return (
		<div className="flex w-full flex-col gap-6">
			{/* Top Bar: Search, Filters, Add Product */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-1 flex-wrap items-center gap-2.5">
					<div className="relative min-w-[260px] flex-1 sm:max-w-md">
						<Icon
							icon={Search}
							className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							value={q}
							onChange={(event) => setQ(event.target.value)}
							placeholder="Search products by name or description..."
							className="h-9 rounded-xl bg-muted/30 pl-9 text-xs placeholder:text-muted-foreground/70 focus-visible:bg-background"
						/>
					</div>

					<Select
						value={status}
						onValueChange={(value) =>
							setStatus(value as "all" | "ACTIVE" | "INACTIVE")
						}
					>
						<SelectTrigger className="h-9 w-32 rounded-xl bg-background text-xs font-medium">
							<SelectValue placeholder="All Statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="ACTIVE">Active</SelectItem>
							<SelectItem value="INACTIVE">Inactive</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={sortBy}
						onValueChange={(value) =>
							setSortBy(value as "name" | "leads" | "deals" | "customers" | "createdAt")
						}
					>
						<SelectTrigger className="h-9 w-36 rounded-xl bg-background text-xs font-medium">
							<SelectValue placeholder="Sort by: Name" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name">Sort by: Name</SelectItem>
							<SelectItem value="leads">Sort by: Leads</SelectItem>
							<SelectItem value="deals">Sort by: Deals</SelectItem>
							<SelectItem value="customers">Sort by: Customers</SelectItem>
							<SelectItem value="createdAt">Sort by: Newest</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<AddProductSheet
					canManage={canManage}
					trigger={
						<Button
							disabled={!canManage}
							className="h-9 gap-1.5 rounded-xl bg-[#5e3da8] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#4d328a]"
						>
							<Icon icon={Add} className="h-3.5 w-3.5" />
							Add Product
						</Button>
					}
				/>
			</div>

			{/* Products List */}
			{list.isLoading ? (
				<div className="flex justify-center py-12">
					<Spinner className="h-6 w-6 text-[#5e3da8]" />
				</div>
			) : sortedRows.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-12 text-center">
					<p className="text-sm font-semibold text-foreground">No products found</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{q.trim()
							? "Try changing your search query or filter."
							: "Add a product to start offering services in your CRM."}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3.5">
					{sortedRows.map((row) => (
						<ProductCard
							key={row.id}
							product={row}
							canManage={canManage}
							onToggleStatus={(nextStatus) =>
								toggleStatusMutation.mutate({
									id: row.id,
									status: nextStatus,
								})
							}
							onDuplicate={() =>
								duplicateMutation.mutate({
									name: `${row.name} (Copy)`,
									shortDescription: row.shortDescription,
									detailedDescription: row.detailedDescription ?? "",
									category: row.category,
									type: row.type,
									color: row.color,
									status: row.status,
									isCore: false,
								})
							}
							onDelete={() => {
								if (confirm(`Are you sure you want to delete ${row.name}?`)) {
									archiveMutation.mutate({ id: row.id });
								}
							}}
						/>
					))}
				</div>
			)}

			{/* Product Display Settings Section */}
			{display.data ? (
				<DisplaySettings
					key={`${display.dataUpdatedAt}`}
					initial={display.data}
					canManage={canManage}
					activeOptions={rows.filter((row) => row.status === "ACTIVE")}
					onSaved={() => invalidateProducts()}
				/>
			) : (
				<div className="flex justify-center py-6">
					<Spinner className="h-5 w-5 text-[#5e3da8]" />
				</div>
			)}
		</div>
	);
}

function ProductCard({
	product,
	canManage,
	onToggleStatus,
	onDuplicate,
	onDelete,
}: {
	product: ProductRow;
	canManage: boolean;
	onToggleStatus: (status: "ACTIVE" | "INACTIVE") => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	const isActive = product.status === "ACTIVE";

	return (
		<div className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-all hover:border-purple-200/80 hover:shadow-sm dark:hover:border-purple-900/50">
			{/* Top Row: Icon + Name + Description + Core Product Badge */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-3.5">
					{/* Product Icon Box */}
					<ProductMark
						name={product.name}
						color={product.color || "#5e3da8"}
						iconUrl={product.iconUrl}
						className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-base font-bold shadow-xs transition-transform group-hover:scale-105"
					/>

					{/* Product Info */}
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="truncate text-base font-bold text-foreground">
								{product.name}
							</h3>
						</div>
						<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
							{product.shortDescription}
						</p>
					</div>
				</div>

				{/* Core Product Badge */}
				{product.isCore ? (
					<span className="shrink-0 rounded-lg border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
						Core Product
					</span>
				) : null}
			</div>

			{/* Bottom Row: Status + Metrics (Leads, Deals, Customers) + Actions */}
			<div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-3">
				{/* Metrics Row */}
				<div className="flex flex-wrap items-center gap-6 sm:gap-8">
					{/* Status */}
					<div className="flex flex-col gap-0.5">
						<span className="text-[10px] font-medium text-muted-foreground uppercase">
							Status
						</span>
						<div className="flex items-center gap-1.5 text-xs font-semibold">
							{isActive ? (
								<>
									<span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
									<span className="text-emerald-600 dark:text-emerald-400">Active</span>
								</>
							) : (
								<>
									<span className="h-2 w-2 rounded-full bg-slate-400 ring-2 ring-slate-400/20" />
									<span className="text-muted-foreground">Inactive</span>
								</>
							)}
						</div>
					</div>

					{/* Leads */}
					<div className="flex flex-col gap-0.5">
						<span className="text-[10px] font-medium text-muted-foreground uppercase">
							Leads
						</span>
						<span className="text-xs font-bold text-foreground">
							{product.counts.leads}
						</span>
					</div>

					{/* Deals */}
					<div className="flex flex-col gap-0.5">
						<span className="text-[10px] font-medium text-muted-foreground uppercase">
							Deals
						</span>
						<span className="text-xs font-bold text-foreground">
							{product.counts.deals}
						</span>
					</div>

					{/* Customers */}
					<div className="flex flex-col gap-0.5">
						<span className="text-[10px] font-medium text-muted-foreground uppercase">
							Customers
						</span>
						<span className="text-xs font-bold text-foreground">
							{product.counts.customers}
						</span>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1.5 ml-auto">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
							>
								<Icon icon={OverflowMenuVertical} className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-44 rounded-xl">
							<DropdownMenuItem
								disabled={!canManage}
								onClick={() => onToggleStatus(isActive ? "INACTIVE" : "ACTIVE")}
								className="gap-2 text-xs font-medium"
							>
								{isActive ? "Deactivate Product" : "Activate Product"}
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!canManage}
								onClick={onDuplicate}
								className="gap-2 text-xs font-medium"
							>
								<Icon icon={Copy} className="h-3.5 w-3.5" />
								Duplicate Product
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								disabled={!canManage}
								onClick={onDelete}
								className="gap-2 text-xs font-medium text-rose-600 focus:text-rose-600 dark:text-rose-400"
							>
								<Icon icon={TrashCan} className="h-3.5 w-3.5" />
								Delete Product
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<AddProductSheet
						canManage={canManage}
						product={product}
						trigger={
							<Button
								variant="outline"
								size="sm"
								disabled={!canManage}
								className="h-8 rounded-xl border-border/80 px-3.5 text-xs font-semibold hover:bg-muted/50"
							>
								Edit
							</Button>
						}
					/>
				</div>
			</div>
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
		<div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
						Product Display Settings
					</h3>
					<p className="mt-0.5 text-xs text-muted-foreground/80">
						Choose which products are available for your team to use in CRM.
					</p>
				</div>
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
					variant="outline"
					className="h-8 rounded-xl border-purple-200 px-4 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40"
				>
					{saveDisplay.isPending ? (
						<Spinner className="mr-1.5 h-3.5 w-3.5" />
					) : null}
					Save Changes
				</Button>
			</div>

			<div className="mt-5 grid grid-cols-1 gap-6 border-t border-border/40 pt-5 md:grid-cols-3">
				{/* Column 1: Show products in */}
				<div className="flex flex-col gap-2.5">
					<label className="text-xs font-semibold text-foreground">
						Show products in
					</label>
					<div className="flex flex-col gap-2 pt-1">
						<label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
							<Checkbox
								checked={showInLeadCreation}
								onCheckedChange={(checked) =>
									setShowInLeadCreation(checked === true)
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8] data-[state=checked]:border-[#5e3da8]"
							/>
							Lead creation
						</label>
						<label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
							<Checkbox
								checked={showInCustomerCreation}
								onCheckedChange={(checked) =>
									setShowInCustomerCreation(checked === true)
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8] data-[state=checked]:border-[#5e3da8]"
							/>
							Customer creation
						</label>
						<label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
							<Checkbox
								checked={showInDealCreation}
								onCheckedChange={(checked) =>
									setShowInDealCreation(checked === true)
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8] data-[state=checked]:border-[#5e3da8]"
							/>
							Deal creation
						</label>
					</div>
				</div>

				{/* Column 2: Set default product */}
				<div className="flex flex-col gap-2">
					<label className="text-xs font-semibold text-foreground">
						Set default product
					</label>
					<Select
						value={defaultProductId ?? "none"}
						onValueChange={(value) =>
							setDefaultProductId(value === "none" ? null : value)
						}
						disabled={!canManage}
					>
						<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
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
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						This product will be pre-selected when creating new leads or deals.
					</p>
				</div>

				{/* Column 3: Allow multiple products per deal */}
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<label className="text-xs font-semibold text-foreground">
							Allow multiple products per deal
						</label>
						<Switch
							checked={allowMultipleOnDeal}
							onCheckedChange={setAllowMultipleOnDeal}
							disabled={!canManage}
							className="data-[state=checked]:bg-[#5e3da8]"
						/>
					</div>
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Enable selection of multiple products in a single deal.
					</p>
				</div>
			</div>
		</div>
	);
}
