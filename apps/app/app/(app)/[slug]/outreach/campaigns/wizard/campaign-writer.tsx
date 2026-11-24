"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
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
import {
	LEAD_CATEGORIES,
	LEAD_CATEGORY_LABEL,
	type LeadCategory,
} from "@crm/validation/lead-origin";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { useTRPC } from "@/lib/trpc/client";
import { audienceFields } from "@/lib/unifers/campaign-draft";
import { UNIFERS } from "@/lib/unifers/unifers-config";

const NO_PRODUCT = "none";
const ANY_CATEGORY = "any";

export type DraftedStep = { subject: string; body: string };

function categoryOf(value: string): LeadCategory | null {
	return LEAD_CATEGORIES.find((category) => category === value) ?? null;
}

export function CampaignWriter({
	list,
	stepCount,
	written,
	onDrafted,
}: {
	list: { id: string; name: string } | null;
	stepCount: number;
	written: boolean;
	onDrafted: (steps: DraftedStep[]) => void;
}) {
	const ids = {
		product: useId(),
		category: useId(),
		purpose: useId(),
		link: useId(),
	};
	const trpc = useTRPC();
	const products = useQuery(trpc.products.options.queryOptions());
	const [productId, setProductId] = useState(NO_PRODUCT);
	const [category, setCategory] = useState(ANY_CATEGORY);
	const [purpose, setPurpose] = useState("");
	const [includeLink, setIncludeLink] = useState(false);

	const sample = useQuery({
		queryKey: [...outreachKeys.lists, "draft-sample", list?.id ?? ""],
		queryFn: () =>
			audienceApi.contacts({
				page: 1,
				limit: UNIFERS.draft.sampleSize,
				listId: list?.id ?? "",
				status: "active",
			}),
		enabled: list !== null,
		retry: false,
	});

	const fields = audienceFields(list ? (sample.data?.data ?? null) : null);

	const draft = useMutation(
		trpc.contacts.draftCampaign.mutationOptions({
			onSuccess: (result) => {
				onDrafted(result.steps);
				toast.success(
					`Claude wrote ${result.steps.length} email${result.steps.length === 1 ? "" : "s"}. Check them before you create the campaign.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const generate = () =>
		draft.mutate({
			productId: productId === NO_PRODUCT ? null : productId,
			category: categoryOf(category),
			purpose: purpose.trim() || null,
			steps: stepCount,
			includeLink,
			audience: {
				name: list?.name ?? null,
				titles: fields.titles,
				companies: fields.companies,
			},
			placeholders: fields.placeholders,
		});

	const busy = draft.isPending || (list !== null && sample.isPending);

	return (
		<FieldGroup>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={ids.product}>Product</FieldLabel>
					<Select
						value={productId}
						disabled={draft.isPending}
						onValueChange={setProductId}
					>
						<SelectTrigger id={ids.product}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NO_PRODUCT}>No product</SelectItem>
							{(products.data?.options ?? []).map((product) => (
								<SelectItem key={product.id} value={product.id}>
									{product.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.category}>Lead type</FieldLabel>
					<Select
						value={category}
						disabled={draft.isPending}
						onValueChange={setCategory}
					>
						<SelectTrigger id={ids.category}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ANY_CATEGORY}>Any</SelectItem>
							{LEAD_CATEGORIES.map((value) => (
								<SelectItem key={value} value={value}>
									{LEAD_CATEGORY_LABEL[value]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>
			<Field>
				<FieldLabel htmlFor={ids.purpose}>
					What are these emails for?
				</FieldLabel>
				<div className="flex gap-2">
					<Input
						id={ids.purpose}
						value={purpose}
						placeholder="Offer dedicated GPU servers to AI startups"
						onChange={(event) => setPurpose(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !busy) generate();
						}}
					/>
					<Button variant="outline" disabled={busy} onClick={generate}>
						{draft.isPending
							? "Writing…"
							: written
								? "Rewrite with AI"
								: "Generate with AI"}
					</Button>
				</div>
				<FieldDescription>
					Claude writes the subject and body of all {stepCount} email
					{stepCount === 1 ? "" : "s"} from this line, the product and the
					audience. It uses {fields.placeholders.join(" and ")}
					{list ? ` from the "${list.name}" list` : ""}. Generating replaces
					what is in the emails below.
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					id={ids.link}
					checked={includeLink}
					disabled={draft.isPending}
					onCheckedChange={(checked) => setIncludeLink(checked === true)}
				/>
				<FieldLabel htmlFor={ids.link}>
					Add a website link to the first email
				</FieldLabel>
			</Field>
		</FieldGroup>
	);
}
