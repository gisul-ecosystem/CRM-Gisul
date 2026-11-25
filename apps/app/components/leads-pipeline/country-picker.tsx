"use client";

import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@crm/ui/components/field";
import { useId } from "react";

export function CountryPicker({
	options,
	value,
	onChange,
	disabled = false,
}: {
	options: readonly string[];
	value: readonly string[];
	onChange: (countries: string[]) => void;
	disabled?: boolean;
}) {
	const id = useId();

	const toggle = (country: string, on: boolean) =>
		onChange(
			options.filter((item) => (item === country ? on : value.includes(item))),
		);

	return (
		<FieldSet>
			<FieldLegend variant="label">Countries</FieldLegend>
			<div className="grid gap-2 sm:grid-cols-3">
				{options.map((country) => (
					<Field key={country} orientation="horizontal">
						<Checkbox
							id={`${id}-${country}`}
							checked={value.includes(country)}
							disabled={disabled}
							onCheckedChange={(checked) => toggle(country, checked === true)}
						/>
						<FieldLabel htmlFor={`${id}-${country}`}>{country}</FieldLabel>
					</Field>
				))}
			</div>
			<FieldDescription>
				For this run only. The cities searched, and the country check when "Only
				companies in the countries ticked" is on in Settings. Settings keeps the
				default.
			</FieldDescription>
		</FieldSet>
	);
}
