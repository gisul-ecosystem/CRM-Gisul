"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { useQuery } from "@tanstack/react-query";
import { DEAL_STAGE_OPTIONS } from "@/lib/deal-stage";
import { useTRPC } from "@/lib/trpc/client";
import styles from "./deals-design.module.css";

const NO_PRODUCT = "none";
const UNASSIGNED = "unassigned";

type FilterId = "product" | "stage" | "company" | "owner";

export function DealsFilters({
	selected,
	onChange,
}: {
	selected: {
		product: string[];
		stage: string[];
		company: string[];
		owner: string[];
	};
	onChange: (id: FilterId, next: string[]) => void;
}) {
	const trpc = useTRPC();
	const products = useQuery(trpc.products.options.queryOptions());
	const companies = useQuery(trpc.companies.options.queryOptions({ q: "" }));
	const users = useQuery(trpc.users.list.queryOptions());

	const productOptions = [
		...(products.data?.options ?? []).map((product) => ({
			value: product.id,
			label: product.name,
		})),
		{ value: NO_PRODUCT, label: "No product" },
	];

	const companyOptions = (companies.data ?? []).map((company) => ({
		value: company.id,
		label: company.name,
	}));

	const ownerOptions = [
		...(users.data ?? []).map((user) => ({
			value: user.id,
			label: user.name.split(/\s+/)[0] || user.name,
		})),
		{ value: UNASSIGNED, label: "Unassigned" },
	];

	return (
		<>
			<FilterMenu
				allLabel="All Products"
				selected={selected.product}
				options={productOptions}
				onChange={(next) => onChange("product", next)}
			/>
			<FilterMenu
				allLabel="All Status"
				selected={selected.stage}
				options={DEAL_STAGE_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				}))}
				onChange={(next) => onChange("stage", next)}
			/>
			<FilterMenu
				allLabel="All Companies"
				selected={selected.company}
				options={companyOptions}
				onChange={(next) => onChange("company", next)}
			/>
			<FilterMenu
				allLabel="All Owners"
				selected={selected.owner}
				options={ownerOptions}
				onChange={(next) => onChange("owner", next)}
			/>
		</>
	);
}

function FilterMenu({
	allLabel,
	selected,
	options,
	onChange,
}: {
	allLabel: string;
	selected: string[];
	options: { value: string; label: string }[];
	onChange: (next: string[]) => void;
}) {
	const label = chipLabel(allLabel, selected, options);
	const active = selected.length > 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={`${styles.filterChip} ${active ? styles.filterChipOn : ""}`}
				>
					{label} <Icon icon={ChevronDown} />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-44 max-h-72 overflow-y-auto">
				<DropdownMenuLabel>{allLabel}</DropdownMenuLabel>
				<DropdownMenuCheckboxItem
					checked={selected.length === 0}
					onCheckedChange={() => onChange([])}
					onSelect={(event) => event.preventDefault()}
				>
					All
				</DropdownMenuCheckboxItem>
				<DropdownMenuSeparator />
				{options.map((option) => {
					const checked = selected.includes(option.value);
					return (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={checked}
							onCheckedChange={() =>
								onChange(toggleValue(selected, option.value))
							}
							onSelect={(event) => event.preventDefault()}
						>
							{option.label}
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function toggleValue(selected: string[], value: string): string[] {
	return selected.includes(value)
		? selected.filter((item) => item !== value)
		: [...selected, value];
}

function chipLabel(
	allLabel: string,
	selected: string[],
	options: { value: string; label: string }[],
): string {
	if (selected.length === 0) return allLabel;
	if (selected.length === 1) {
		const match = options.find((option) => option.value === selected[0]);
		return match?.label ?? selected[0] ?? allLabel;
	}
	return `${selected.length} selected`;
}
