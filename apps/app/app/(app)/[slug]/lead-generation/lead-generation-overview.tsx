"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { StatCard } from "@crm/ui/components/stat-card";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { PipelinePage } from "@/components/leads-pipeline/pipeline-page";
import { RunLog } from "@/components/leads-pipeline/run-log";
import { LocalDateTime } from "@/components/local-date-time";
import { pipelineApi } from "@/lib/leads-pipeline/api";
import { usePipelineCache } from "@/lib/leads-pipeline/cache";
import { sourceLabel } from "@/lib/leads-pipeline/labels";
import type { ProfileStatus } from "@/lib/leads-pipeline/schemas";
import { COUNT, DATE_TIME } from "@/lib/outreach/format";

export function LeadGenerationOverview() {
	return (
		<PipelinePage
			title="Lead generation"
			description="Finds companies and decision makers from public sources, checks their emails, and scores each lead."
		>
			{(profile) => <OverviewBody key={profile.profile} status={profile} />}
		</PipelinePage>
	);
}

function OverviewBody({ status }: { status: ProfileStatus }) {
	const { summary } = status;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<div className="grid grid-cols-2 divide-x divide-y md:grid-cols-5 md:divide-y-0">
					<StatCard label="Companies" value={COUNT.format(summary.companies)} />
					<StatCard label="People" value={COUNT.format(summary.people)} />
					<StatCard label="Emails" value={COUNT.format(summary.emails)} />
					<StatCard label="Verified" value={COUNT.format(summary.valid)} />
					<StatCard label="Ready" value={COUNT.format(summary.ready)} />
				</div>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<RunCard status={status} />
				<LastRunCard status={status} />
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Run log</CardTitle>
					<CardDescription>The newest lines first.</CardDescription>
				</CardHeader>
				<CardContent>
					<RunLog profile={status.profile} running={status.running} />
				</CardContent>
			</Card>
		</div>
	);
}

function RunCard({ status }: { status: ProfileStatus }) {
	const cache = usePipelineCache();
	const batchId = useId();
	const [sources, setSources] = useState<string[]>(status.dailySources);
	const [batch, setBatch] = useState(String(status.batch));
	const batchNumber = Number(batch);
	const batchValid =
		Number.isInteger(batchNumber) &&
		batchNumber >= 1 &&
		batchNumber <= status.maxBatch;

	const start = useMutation({
		mutationFn: () => pipelineApi.run(status.profile, batchNumber, sources),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.run(status.profile);
		},
		onError: (error) => toast.error(error.message),
	});
	const stop = useMutation({
		mutationFn: () => pipelineApi.stop(status.profile),
		onSuccess: (result) => {
			toast.success(result.message);
			void cache.run(status.profile);
		},
		onError: (error) => toast.error(error.message),
	});

	const toggle = (source: string, on: boolean) =>
		setSources((current) =>
			on
				? status.sources.filter(
						(item) => item === source || current.includes(item),
					)
				: current.filter((item) => item !== source),
		);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Run</CardTitle>
				<CardDescription>
					{status.runAt
						? `Runs by itself every day at ${status.runAt}.`
						: "No daily run. Set a run time in Settings."}
				</CardDescription>
				<CardAction>
					<StatusIndicator
						tone={status.running ? "success" : "neutral"}
						label={status.running ? "Running" : "Idle"}
						pulse={status.running}
						size="sm"
					/>
				</CardAction>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<FieldSet>
						<FieldLegend variant="label">Sources</FieldLegend>
						<div className="grid gap-2 sm:grid-cols-2">
							{status.sources.map((source) => (
								<Field key={source} orientation="horizontal">
									<Checkbox
										id={`${batchId}-${source}`}
										checked={sources.includes(source)}
										disabled={status.running}
										onCheckedChange={(checked) =>
											toggle(source, checked === true)
										}
									/>
									<FieldLabel htmlFor={`${batchId}-${source}`}>
										{sourceLabel(source)}
									</FieldLabel>
								</Field>
							))}
						</div>
					</FieldSet>
					<Field>
						<FieldLabel htmlFor={batchId}>Companies in this run</FieldLabel>
						<Input
							id={batchId}
							type="number"
							inputMode="numeric"
							min={1}
							max={status.maxBatch}
							value={batch}
							disabled={status.running}
							onChange={(event) => setBatch(event.target.value)}
						/>
						<FieldDescription>
							Between 1 and {COUNT.format(status.maxBatch)}. Work done so far is
							saved when a run stops.
						</FieldDescription>
					</Field>
					<div className="flex flex-wrap gap-2">
						{status.running ? (
							<Button
								variant="outline"
								size="sm"
								disabled={stop.isPending || !status.ours}
								onClick={() => stop.mutate()}
							>
								Stop run
							</Button>
						) : (
							<Button
								size="sm"
								disabled={
									start.isPending || sources.length === 0 || !batchValid
								}
								onClick={() => start.mutate()}
							>
								Start run
							</Button>
						)}
					</div>
					{status.running && !status.ours ? (
						<p className="text-muted-foreground text-xs">
							The daily schedule or another process started this run. It cannot
							be stopped from here.
						</p>
					) : null}
				</FieldGroup>
			</CardContent>
		</Card>
	);
}

function LastRunCard({ status }: { status: ProfileStatus }) {
	const last = status.lastRun;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Last run</CardTitle>
				<CardDescription>
					{status.updated ? (
						<>
							Sheet updated{" "}
							<LocalDateTime date={status.updated} options={DATE_TIME} />
						</>
					) : (
						"No leads yet. Start a run."
					)}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{last ? (
					<div className="flex flex-col gap-3 text-sm">
						<p className="text-muted-foreground text-xs">
							{last.started ?? "—"} to {last.finished ?? "not finished"}
						</p>
						<div className="grid grid-cols-3 gap-3">
							<LastRunFigure
								label={`New ${status.noun}`}
								value={last.newCompanies}
							/>
							<LastRunFigure label="New people" value={last.newPeople} />
							<LastRunFigure label="Newly ready" value={last.newReady} />
						</div>
						<div className="flex flex-wrap gap-3 text-xs">
							<StatusIndicator
								tone="success"
								label={`High intent: ${COUNT.format(status.summary.intent.high)}`}
								size="sm"
							/>
							<StatusIndicator
								tone="info"
								label={`Medium: ${COUNT.format(status.summary.intent.medium)}`}
								size="sm"
							/>
							<StatusIndicator
								tone="neutral"
								label={`Low: ${COUNT.format(status.summary.intent.low)}`}
								size="sm"
							/>
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-xs">
						No finished run is recorded for this profile.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function LastRunFigure({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="font-medium text-xl tabular-nums">
				{COUNT.format(value)}
			</span>
		</div>
	);
}
