"use client";

import Add from "@carbon/icons-react/es/Add";
import { ProductStatus } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
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
import { Switch } from "@crm/ui/components/switch";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function AddProductSheet({
	canManage,
	product,
	trigger,
	open: controlledOpen,
	onOpenChange: setControlledOpen,
}: {
	canManage: boolean;
	product?: {
		id: string;
		name: string;
		shortDescription: string;
		detailedDescription: string | null;
		category: string;
		type: string;
		color: string;
		status: ProductStatus;
		isCore: boolean;
	};
	trigger?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const meta = useQuery(trpc.products.meta.queryOptions());
	const [internalOpen, setInternalOpen] = useState(false);

	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	const setOpen = (next: boolean) => {
		if (isControlled) {
			setControlledOpen?.(next);
		} else {
			setInternalOpen(next);
		}
	};

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.products.pathKey() });

	const nameId = useId();
	const shortId = useId();
	const detailId = useId();

	const editing = Boolean(product);
	const [name, setName] = useState(product?.name ?? "");
	const [shortDescription, setShortDescription] = useState(
		product?.shortDescription ?? "",
	);
	const [detailedDescription, setDetailedDescription] = useState(
		product?.detailedDescription ?? "",
	);
	const [category, setCategory] = useState(
		product?.category ?? "Core Software",
	);
	const [type, setType] = useState(product?.type ?? "SaaS Platform");
	const [color, setColor] = useState(product?.color ?? "#5e3da8");
	const [status, setStatus] = useState<ProductStatus>(
		product?.status ?? ProductStatus.ACTIVE,
	);
	const [isCore, setIsCore] = useState(product?.isCore ?? false);

	const reset = () => {
		setName(product?.name ?? "");
		setShortDescription(product?.shortDescription ?? "");
		setDetailedDescription(product?.detailedDescription ?? "");
		setCategory(product?.category ?? "Core Software");
		setType(product?.type ?? "SaaS Platform");
		setColor(product?.color ?? "#5e3da8");
		setStatus(product?.status ?? ProductStatus.ACTIVE);
		setIsCore(product?.isCore ?? false);
	};

	const create = useMutation(
		trpc.products.create.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success(`${name.trim()} added successfully.`);
				setOpen(false);
				reset();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const update = useMutation(
		trpc.products.update.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success(`${name.trim()} updated successfully.`);
				setOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const pending = create.isPending || update.isPending;
	const colors = meta.data?.colors ?? [
		"#5e3da8",
		"#22c55e",
		"#ef4444",
		"#8b5cf6",
		"#3b82f6",
		"#f59e0b",
		"#ec4899",
		"#14b8a6",
	];
	const categories = meta.data?.categories ?? [
		"Core Software",
		"Cloud Infrastructure",
		"EdTech & Skills",
		"Marketing & CRM",
		"Consulting",
	];
	const types = meta.data?.types ?? [
		"SaaS Platform",
		"Infrastructure Service",
		"Assessment Tool",
		"Integration",
		"Service Package",
	];

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) reset();
			}}
		>
			{trigger ? (
				<SheetTrigger asChild>{trigger}</SheetTrigger>
			) : !isControlled ? (
				<SheetTrigger asChild>
					{editing ? (
						<Button
							variant="outline"
							size="sm"
							disabled={!canManage}
							className="h-8 rounded-xl border-border/80 px-3.5 text-xs font-semibold hover:bg-muted/50"
						>
							Edit
						</Button>
					) : (
						<Button
							disabled={!canManage}
							className="h-9 gap-1.5 rounded-xl bg-[#5e3da8] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#4d328a]"
						>
							<Icon icon={Add} className="h-3.5 w-3.5" />
							Add Product
						</Button>
					)}
				</SheetTrigger>
			) : null}

			<SheetContent side="right" className="flex flex-col sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>{editing ? "Edit Product" : "Add Product"}</SheetTitle>
					<SheetDescription>
						{editing
							? "Update your product details, category, and display settings."
							: "Add a new product or service to your CRM catalog."}
					</SheetDescription>
				</SheetHeader>

				<form
					className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2"
					onSubmit={(event) => {
						event.preventDefault();
						const payload = {
							name,
							shortDescription,
							detailedDescription,
							category,
							type,
							color,
							status,
							isCore,
						};
						if (editing && product) {
							update.mutate({ id: product.id, ...payload });
						} else {
							create.mutate(payload);
						}
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Product Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="e.g. Aaptor, Racko, Kanonkode"
								className="rounded-xl"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={shortId}>Short Description</FieldLabel>
							<Textarea
								id={shortId}
								value={shortDescription}
								onChange={(event) =>
									setShortDescription(event.target.value.slice(0, 150))
								}
								placeholder="Brief description about what this product offers..."
								className="rounded-xl resize-none"
								rows={2}
								required
							/>
							<FieldDescription>
								{shortDescription.length}/150 characters
							</FieldDescription>
						</Field>

						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel>Category</FieldLabel>
								<Select value={category} onValueChange={setCategory} required>
									<SelectTrigger className="rounded-xl">
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent>
										{categories.map((item) => (
											<SelectItem key={item} value={item}>
												{item}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel>Product Type</FieldLabel>
								<Select value={type} onValueChange={setType} required>
									<SelectTrigger className="rounded-xl">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										{types.map((item) => (
											<SelectItem key={item} value={item}>
												{item}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>

						<Field>
							<FieldLabel htmlFor={detailId}>
								Detailed Description (Optional)
							</FieldLabel>
							<Textarea
								id={detailId}
								value={detailedDescription}
								onChange={(event) =>
									setDetailedDescription(event.target.value.slice(0, 500))
								}
								placeholder="Add key features, target audience, pricing models..."
								className="rounded-xl resize-none"
								rows={3}
							/>
							<FieldDescription>
								{detailedDescription.length}/500 characters
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel>Product Theme Colour</FieldLabel>
							<div className="flex flex-wrap gap-2.5 pt-1">
								{colors.map((swatch) => (
									<button
										key={swatch}
										type="button"
										aria-label={`Colour ${swatch}`}
										className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
										style={{
											background: swatch,
											borderColor:
												color.toLowerCase() === swatch.toLowerCase()
													? "#1c1a2e"
													: "transparent",
											boxShadow:
												color.toLowerCase() === swatch.toLowerCase()
													? "0 0 0 2px rgba(94,61,168,0.4)"
													: "none",
										}}
										onClick={() => setColor(swatch)}
									/>
								))}
							</div>
						</Field>

						<div className="grid grid-cols-2 gap-3 pt-1">
							<Field>
								<FieldLabel>Status</FieldLabel>
								<Select
									value={status}
									onValueChange={(value) => setStatus(value as ProductStatus)}
								>
									<SelectTrigger className="rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ProductStatus.ACTIVE}>Active</SelectItem>
										<SelectItem value={ProductStatus.INACTIVE}>
											Inactive
										</SelectItem>
									</SelectContent>
								</Select>
							</Field>

							<Field className="flex flex-col justify-end">
								<div className="flex items-center justify-between rounded-xl border border-border/60 p-2.5">
									<span className="text-xs font-medium">Core Product</span>
									<Switch
										checked={isCore}
										onCheckedChange={setIsCore}
										className="data-[state=checked]:bg-[#5e3da8]"
									/>
								</div>
							</Field>
						</div>
					</FieldGroup>

					<SheetFooter className="mt-auto border-t border-border/40 pt-4">
						<SheetClose asChild>
							<Button type="button" variant="outline" className="rounded-xl">
								Cancel
							</Button>
						</SheetClose>
						<Button
							type="submit"
							disabled={pending || !canManage}
							className="rounded-xl bg-[#5e3da8] text-white hover:bg-[#4d328a]"
						>
							{pending ? <Spinner data-icon="inline-start" /> : null}
							{editing ? "Save Changes" : "Create Product"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
