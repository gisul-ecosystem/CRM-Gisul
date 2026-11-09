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
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Skeleton } from "@crm/ui/components/skeleton";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { PipelinePage } from "@/components/leads-pipeline/pipeline-page";
import { settingsApi } from "@/lib/leads-pipeline/api";
import { pipelineKeys, usePipelineCache } from "@/lib/leads-pipeline/cache";
import { segmentLabel, sourceLabel } from "@/lib/leads-pipeline/labels";
import type {
	LeadProfile,
	PipelineSettings,
	SettingsUpdate,
} from "@/lib/leads-pipeline/schemas";

export function SettingsView() {
	return (
		<PipelinePage
			title="Lead generation settings"
			description="What each profile looks for, how much it does per run, and the keys it uses. Saved settings apply from the next run."
		>
			{(profile) => (
				<SettingsLoader key={profile.profile} profile={profile.profile} />
			)}
		</PipelinePage>
	);
}

function SettingsLoader({ profile }: { profile: LeadProfile }) {
	const settings = useQuery({
		queryKey: pipelineKeys.settings(profile),
		queryFn: () => settingsApi.get(profile),
	});

	if (settings.isPending)
		return <Skeleton className="h-96 w-full rounded-lg" />;
	if (settings.isError) {
		return <p className="text-destructive text-xs">{settings.error.message}</p>;
	}
	return <SettingsForm key={settings.dataUpdatedAt} settings={settings.data} />;
}

function initialUpdate(settings: PipelineSettings): SettingsUpdate {
	return {
		profile: settings.profile,
		flags: Object.fromEntries(
			settings.flags.map((flag) => [flag.key, flag.on]),
		),
		numbers: Object.fromEntries(
			settings.numbers.map((number) => [number.key, number.value]),
		),
		texts: Object.fromEntries(
			settings.texts.map((text) => [text.key, text.value]),
		),
		secrets: {},
		clearSecrets: [],
		segments: settings.segments.selected,
		countries: settings.countries.selected,
		skipSources: settings.sources.skipped,
		earlyExempt: settings.earlyExempt?.selected ?? [],
	};
}

function toggled(list: string[], value: string, on: boolean): string[] {
	return on
		? [...new Set([...list, value])]
		: list.filter((item) => item !== value);
}

function SettingsForm({ settings }: { settings: PipelineSettings }) {
	const id = useId();
	const queryClient = useQueryClient();
	const cache = usePipelineCache();
	const [form, setForm] = useState<SettingsUpdate>(() =>
		initialUpdate(settings),
	);

	const save = useMutation({
		mutationFn: () => settingsApi.save(form),
		onSuccess: (saved) => {
			queryClient.setQueryData(pipelineKeys.settings(saved.profile), saved);
			void cache.everything();
			toast.success(`Settings saved for ${saved.label}.`);
		},
		onError: (error) => toast.error(error.message),
	});

	const set = (next: Partial<SettingsUpdate>) =>
		setForm((current) => ({ ...current, ...next }));

	return (
		<div className="flex flex-col gap-6">
			<SettingsCard
				title="Rules"
				description="Which companies the pipeline keeps."
			>
				<FieldGroup>
					{settings.flags.map((flag) => (
						<Field key={flag.key} orientation="horizontal">
							<Switch
								id={`${id}-${flag.key}`}
								checked={form.flags[flag.key] ?? false}
								onCheckedChange={(on) =>
									set({ flags: { ...form.flags, [flag.key]: on } })
								}
							/>
							<FieldLabel htmlFor={`${id}-${flag.key}`}>
								{flag.label}
							</FieldLabel>
						</Field>
					))}
				</FieldGroup>
			</SettingsCard>

			<SettingsCard title="Limits" description="How much one run does.">
				<div className="grid gap-4 md:grid-cols-2">
					{settings.numbers.map((number) => (
						<Field key={number.key}>
							<FieldLabel htmlFor={`${id}-${number.key}`}>
								{number.label}
							</FieldLabel>
							<Input
								id={`${id}-${number.key}`}
								type="number"
								min={number.min}
								max={number.max}
								step={number.key === "DOMAIN_DELAY" ? 0.5 : 1}
								value={form.numbers[number.key] ?? ""}
								onChange={(event) =>
									set({
										numbers: {
											...form.numbers,
											[number.key]: event.target.value,
										},
									})
								}
							/>
							<FieldDescription>
								From {number.min} to {number.max}.
							</FieldDescription>
						</Field>
					))}
				</div>
			</SettingsCard>

			<SettingsCard title="Run and connection">
				<FieldGroup>
					{settings.texts.map((text) => (
						<Field key={text.key}>
							<FieldLabel htmlFor={`${id}-${text.key}`}>
								{text.label}
							</FieldLabel>
							<Input
								id={`${id}-${text.key}`}
								value={form.texts[text.key] ?? ""}
								placeholder={text.key === "RUN_AT" ? "02:00" : undefined}
								onChange={(event) =>
									set({
										texts: { ...form.texts, [text.key]: event.target.value },
									})
								}
							/>
						</Field>
					))}
				</FieldGroup>
			</SettingsCard>

			{settings.secrets.length > 0 ? (
				<SettingsCard
					title="API keys"
					description="Shared by every profile. A saved key is never shown. Leave a field blank to keep the saved key."
				>
					<FieldGroup>
						{settings.secrets.map((secret) => {
							const clearing = form.clearSecrets.includes(secret.key);
							return (
								<Field key={secret.key}>
									<FieldLabel htmlFor={`${id}-${secret.key}`}>
										{secret.label}
									</FieldLabel>
									<Input
										id={`${id}-${secret.key}`}
										type="password"
										autoComplete="off"
										disabled={clearing}
										placeholder={secret.set ? "Saved" : "Not set"}
										value={form.secrets[secret.key] ?? ""}
										onChange={(event) =>
											set({
												secrets: {
													...form.secrets,
													[secret.key]: event.target.value,
												},
											})
										}
									/>
									{secret.set ? (
										<Field orientation="horizontal">
											<Checkbox
												id={`${id}-${secret.key}-clear`}
												checked={clearing}
												onCheckedChange={(checked) =>
													set({
														clearSecrets: toggled(
															form.clearSecrets,
															secret.key,
															checked === true,
														),
													})
												}
											/>
											<FieldLabel htmlFor={`${id}-${secret.key}-clear`}>
												Remove the saved key
											</FieldLabel>
										</Field>
									) : null}
								</Field>
							);
						})}
					</FieldGroup>
				</SettingsCard>
			) : null}

			<SettingsCard title="Sources" description="Sources the daily run uses.">
				<CheckboxGrid
					id={`${id}-sources`}
					options={settings.sources.options}
					label={sourceLabel}
					checked={(source) => !form.skipSources.includes(source)}
					onChange={(source, on) =>
						set({ skipSources: toggled(form.skipSources, source, !on) })
					}
				/>
			</SettingsCard>

			<SettingsCard
				title="Segments"
				description="The kinds of company to look for."
			>
				<CheckboxGrid
					id={`${id}-segments`}
					options={settings.segments.options}
					label={segmentLabel}
					checked={(segment) => form.segments.includes(segment)}
					onChange={(segment, on) =>
						set({ segments: toggled(form.segments, segment, on) })
					}
				/>
			</SettingsCard>

			<SettingsCard title="Countries">
				<CheckboxGrid
					id={`${id}-countries`}
					options={settings.countries.options}
					label={(country) => country}
					checked={(country) => form.countries.includes(country)}
					onChange={(country, on) =>
						set({ countries: toggled(form.countries, country, on) })
					}
				/>
			</SettingsCard>

			{settings.earlyExempt ? (
				<SettingsCard
					title="Exempt from the early-stage rule"
					description="These segments are kept at any company age."
				>
					<CheckboxGrid
						id={`${id}-exempt`}
						options={settings.earlyExempt.options}
						label={segmentLabel}
						checked={(segment) => form.earlyExempt.includes(segment)}
						onChange={(segment, on) =>
							set({ earlyExempt: toggled(form.earlyExempt, segment, on) })
						}
					/>
				</SettingsCard>
			) : null}

			<div className="flex justify-end">
				<Button disabled={save.isPending} onClick={() => save.mutate()}>
					Save settings
				</Button>
			</div>
		</div>
	);
}

function SettingsCard({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function CheckboxGrid({
	id,
	options,
	label,
	checked,
	onChange,
}: {
	id: string;
	options: readonly string[];
	label: (value: string) => string;
	checked: (value: string) => boolean;
	onChange: (value: string, on: boolean) => void;
}) {
	return (
		<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{options.map((option) => (
				<Field key={option} orientation="horizontal">
					<Checkbox
						id={`${id}-${option}`}
						checked={checked(option)}
						onCheckedChange={(value) => onChange(option, value === true)}
					/>
					<FieldContent>
						<FieldLabel htmlFor={`${id}-${option}`}>{label(option)}</FieldLabel>
					</FieldContent>
				</Field>
			))}
		</div>
	);
}
