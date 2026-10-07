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
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function AddProductSheet({
	canManage,
	product,
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
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const meta = useQuery(trpc.products.meta.queryOptions());
	const [open, setOpen] = useState(false);

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
	const [category, setCategory] = useState(product?.category ?? "");
	const [type, setType] = useState(product?.type ?? "");
	const [color, setColor] = useState(product?.color ?? "#1a9b6a");
	const [status, setStatus] = useState<ProductStatus>(
		product?.status ?? ProductStatus.ACTIVE,
	);
	const [isCore, setIsCore] = useState(product?.isCore ?? false);

	const reset = () => {
		setName(product?.name ?? "");
		setShortDescription(product?.shortDescription ?? "");
		setDetailedDescription(product?.detailedDescription ?? "");
		setCategory(product?.category ?? "");
		setType(product?.type ?? "");
		setColor(product?.color ?? "#1a9b6a");
		setStatus(product?.status ?? ProductStatus.ACTIVE);
		setIsCore(product?.isCore ?? false);
	};

	const create = useMutation(
		trpc.products.create.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success(`${name.trim()} added.`);
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
				toast.success(`${name.trim()} saved.`);
				setOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const pending = create.isPending || update.isPending;
	const colors = meta.data?.colors ?? [];
	const categories = meta.data?.categories ?? [];
	const types = meta.data?.types ?? [];

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) reset();
			}}
		>
			<SheetTrigger asChild>
				{editing ? (
					<Button variant="outline" size="sm" disabled={!canManage}>
						Edit
					</Button>
				) : (
					<Button disabled={!canManage}>
						<Icon icon={Add} data-icon="inline-start" />
						Add Product
					</Button>
				)}
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>{editing ? "Edit product" : "Add product"}</SheetTitle>
					<SheetDescription>
						Add a new product or service to your CRM.
					</SheetDescription>
				</SheetHeader>
				<form
					className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
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
							<FieldLabel htmlFor={nameId}>Product name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Enter product name"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={shortId}>Short description</FieldLabel>
							<Textarea
								id={shortId}
								value={shortDescription}
								onChange={(event) =>
									setShortDescription(event.target.value.slice(0, 150))
								}
								placeholder="Brief description about the product..."
								required
							/>
							<FieldDescription>
								{shortDescription.length}/150
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>Category</FieldLabel>
							<Select value={category} onValueChange={setCategory} required>
								<SelectTrigger>
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
							<FieldLabel>Product type</FieldLabel>
							<Select value={type} onValueChange={setType} required>
								<SelectTrigger>
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
						<Field>
							<FieldLabel htmlFor={detailId}>
								Detailed description (optional)
							</FieldLabel>
							<Textarea
								id={detailId}
								value={detailedDescription}
								onChange={(event) =>
									setDetailedDescription(event.target.value.slice(0, 500))
								}
								placeholder="Add detailed description, key features, use cases..."
							/>
							<FieldDescription>
								{detailedDescription.length}/500
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>Product colour</FieldLabel>
							<div className="flex flex-wrap gap-2">
								{colors.map((swatch) => (
									<button
										key={swatch}
										type="button"
										aria-label={`Colour ${swatch}`}
										className="size-7 rounded-full border-2"
										style={{
											background: swatch,
											borderColor:
												color.toLowerCase() === swatch ? "#1c1a2e" : "transparent",
										}}
										onClick={() => setColor(swatch)}
									/>
								))}
							</div>
						</Field>
						<Field>
							<FieldLabel>Status</FieldLabel>
							<Select
								value={status}
								onValueChange={(value) => setStatus(value as ProductStatus)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ProductStatus.ACTIVE}>Active</SelectItem>
									<SelectItem value={ProductStatus.INACTIVE}>
										Inactive
									</SelectItem>
								</SelectContent>
							</Select>
							<FieldDescription>
								Inactive products won&apos;t be shown when creating leads or
								deals.
							</FieldDescription>
						</Field>
						<Field>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={isCore}
									onChange={(event) => setIsCore(event.target.checked)}
								/>
								Mark as core product
							</label>
						</Field>
					</FieldGroup>
					<SheetFooter>
						<SheetClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</SheetClose>
						<Button type="submit" disabled={pending || !canManage}>
							{pending ? <Spinner data-icon="inline-start" /> : null}
							{editing ? "Save product" : "Save product"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
