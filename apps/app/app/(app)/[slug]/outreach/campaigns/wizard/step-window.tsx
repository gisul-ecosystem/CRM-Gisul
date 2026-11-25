"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useId } from "react";
import { CAMPAIGN } from "@/lib/outreach/campaign-rules";
import {
	minuteToTime,
	timeToMinute,
	WEEKDAYS,
	windowSummary,
} from "@/lib/outreach/labels";
import { sendWindowProblem, type WizardForm } from "@/lib/outreach/wizard";

export function StepWindow({
	form,
	onChange,
	timezone,
}: {
	form: WizardForm;
	onChange: (patch: Partial<WizardForm>) => void;
	timezone: string | null;
}) {
	const startId = useId();
	const endId = useId();
	const window = form.sendWindow;
	const problem = sendWindowProblem(window);
	const { endOfDayMinute, lastStartMinute, stepSeconds, recommended } =
		CAMPAIGN.window;

	const set = (patch: Partial<WizardForm["sendWindow"]>) =>
		onChange({ sendWindow: { ...window, ...patch } });

	return (
		<div className="flex max-w-xl flex-col gap-5">
			<Field>
				<FieldLabel>Days</FieldLabel>
				<ToggleGroup
					type="multiple"
					variant="outline"
					value={window.days.map(String)}
					onValueChange={(values) =>
						set({
							days: values.map(Number).sort((first, second) => first - second),
						})
					}
					size="sm"
					spacing={1}
				>
					{WEEKDAYS.map((weekday) => (
						<ToggleGroupItem
							key={weekday.day}
							value={String(weekday.day)}
							aria-label={weekday.long}
						>
							{weekday.short}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</Field>

			<div className="grid grid-cols-2 gap-4">
				<Field>
					<FieldLabel htmlFor={startId}>From</FieldLabel>
					<Input
						id={startId}
						type="time"
						step={stepSeconds}
						value={minuteToTime(window.startMinute)}
						onChange={(event) =>
							set({
								startMinute: Math.min(
									timeToMinute(event.target.value),
									lastStartMinute,
								),
							})
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={endId}>Until</FieldLabel>
					<Input
						id={endId}
						type="time"
						step={stepSeconds}
						value={
							window.endMinute === endOfDayMinute
								? "00:00"
								: minuteToTime(window.endMinute)
						}
						onChange={(event) => {
							const minute = timeToMinute(event.target.value);
							set({ endMinute: minute === 0 ? endOfDayMinute : minute });
						}}
					/>
				</Field>
			</div>

			{problem ? <p className="text-destructive text-xs">{problem}</p> : null}

			<FieldDescription>
				Times are in{" "}
				<span className="font-medium text-foreground">{timezone ?? "…"}</span>,
				the Outreach timezone. Recommended:{" "}
				{windowSummary({
					startMinute: recommended.startMinute,
					endMinute: recommended.endMinute,
					days: [...recommended.days],
				})}
				, when people read work email.
			</FieldDescription>

			<Button
				variant="outline"
				size="sm"
				className="w-fit"
				onClick={() =>
					onChange({
						sendWindow: {
							startMinute: recommended.startMinute,
							endMinute: recommended.endMinute,
							days: [...recommended.days],
						},
					})
				}
			>
				Use recommended
			</Button>
		</div>
	);
}
