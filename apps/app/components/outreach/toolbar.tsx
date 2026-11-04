"use client";

import Search from "@carbon/icons-react/es/Search";
import { Icon } from "@crm/ui/components/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@crm/ui/components/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import type { ReactNode } from "react";

export const ALL = "all";

export function OutreachToolbar({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SearchBox({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	return (
		<InputGroup className="w-full sm:w-72">
			<InputGroupAddon>
				<Icon icon={Search} />
			</InputGroupAddon>
			<InputGroupInput
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
			/>
		</InputGroup>
	);
}

export function FilterSelect<T extends string>({
	value,
	onChange,
	options,
	label,
}: {
	value: T;
	onChange: (value: T) => void;
	options: readonly { value: T; label: string }[];
	label: string;
}) {
	return (
		<Select
			value={value}
			onValueChange={(next) => {
				const match = options.find((option) => option.value === next);
				if (match) onChange(match.value);
			}}
		>
			<SelectTrigger className="w-44" aria-label={label}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
