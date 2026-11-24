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
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConnectMailboxDialog } from "@/components/unifers/connect-mailbox-dialog";
import {
	UnifersPage,
	useUnifersHealth,
} from "@/components/unifers/unifers-page";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { COUNT } from "@/lib/outreach/format";
import { useTRPC } from "@/lib/trpc/client";
import { campaignsApi } from "@/lib/unifers/api";
import { useUnifersCache } from "@/lib/unifers/cache";
import { withSignOff } from "@/lib/unifers/campaign-draft";
import { UNIFERS_ACCOUNT_STATUS, WEEKDAYS } from "@/lib/unifers/labels";
import {
	addLeadsInBatches,
	audienceLeads,
	leadsSummary,
	mergeResults,
} from "@/lib/unifers/leads";
import type { NewCampaign, SequenceStep } from "@/lib/unifers/schemas";
import { unifersRouteId } from "@/lib/unifers/sender";
import { UNIFERS } from "@/lib/unifers/unifers-config";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { CampaignWriter, type DraftedStep } from "./campaign-writer";

const NO_LIST = "none";

type Launch = "draft" | "now" | "schedule";

function firstStep(): SequenceStep {
	return {
		subject: "Quick question, {{firstName | there}}",
		body: "Hi {{firstName | there}},\n\n",
		waitDays: 0,
	};
}

export function UnifersCampaignWizard() {
	return (
		<UnifersPage
			title="New campaign"
			description="Sent with Unifers, from your Unifers mailboxes."
		>
			<WizardBody />
		</UnifersPage>
	);
}

function WizardBody() {
	const ids = {
		name: useId(),
		list: useId(),
		start: useId(),
		end: useId(),
		zone: useId(),
		when: useId(),
		signOff: useId(),
	};
	const router = useRouter();
	const href = useWorkspaceUrl();
	const cache = useUnifersCache();
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const isAdmin = workspace.data?.canChangeRoles ?? false;
	const accounts = useUnifersHealth();

	const [name, setName] = useState("");
	const [listId, setListId] = useState<string>(NO_LIST);
	const [steps, setSteps] = useState<SequenceStep[]>([firstStep()]);
	const [senders, setSenders] = useState<string[]>([]);
	const [windowStart, setWindowStart] = useState<string>(
		UNIFERS.defaultWindow.start,
	);
	const [windowEnd, setWindowEnd] = useState<string>(UNIFERS.defaultWindow.end);
	const [days, setDays] = useState<number[]>([...UNIFERS.defaultWindow.days]);
	const [timeZone, setTimeZone] = useState<string>(UNIFERS.defaultTimeZone);
	const [stopOnReply, setStopOnReply] = useState(true);
	const [stopOnClick, setStopOnClick] = useState(false);
	const [launch, setLaunch] = useState<Launch>("draft");
	const [scheduleAt, setScheduleAt] = useState("");
	const [connectOpen, setConnectOpen] = useState(false);
	const [progress, setProgress] = useState("");
	const [signOff, setSignOff] = useState(true);
	const [written, setWritten] = useState(false);

	const lists = useQuery({
		queryKey: [...outreachKeys.lists, "unifers-wizard"],
		queryFn: () => audienceApi.lists({ page: 1, limit: 100 }),
		retry: false,
	});

	const mailboxes = accounts.data?.accounts ?? [];
	const chosenList = lists.data?.data.find((list) => list.id === listId);

	const applyDraft = (drafted: DraftedStep[]) => {
		setSteps((current) =>
			drafted.map((step, index) => ({
				subject: step.subject,
				body: step.body,
				waitDays:
					index === 0
						? 0
						: (current[index]?.waitDays ?? UNIFERS.followUpWaitDays),
			})),
		);
		setWritten(true);
	};

	const updateStep = (index: number, next: Partial<SequenceStep>) =>
		setSteps((current) =>
			current.map((step, i) => (i === index ? { ...step, ...next } : step)),
		);

	const create = useMutation({
		mutationFn: async () => {
			setProgress(chosenList ? "Reading the audience list…" : "Creating…");
			const leads = chosenList ? await audienceLeads(chosenList.id) : [];
			const first = leads.slice(0, UNIFERS.maxLeadsPerCall);
			const rest = leads.slice(UNIFERS.maxLeadsPerCall);
			const input: NewCampaign = {
				name: name.trim(),
				senders,
				sequence: steps.map((step, index) => ({
					subject: step.subject,
					body: signOff ? withSignOff(step.body) : step.body,
					waitDays: index === 0 ? 0 : step.waitDays,
				})),
				sendWindow: { start: windowStart, end: windowEnd, days, timeZone },
				stopConditions: { onReply: stopOnReply, onClick: stopOnClick },
				...(launch === "now" ? { startAt: "now" } : {}),
				...(launch === "schedule" && scheduleAt
					? { startAt: new Date(scheduleAt).toISOString() }
					: {}),
			};
			setProgress("Creating the campaign in Unifers…");
			const created = await campaignsApi.create({
				...input,
				...(first.length ? { leads: first } : {}),
			});
			let result = created.leads;
			if (rest.length) {
				setProgress(`Adding ${COUNT.format(rest.length)} more leads…`);
				const more = await addLeadsInBatches(
					created.campaign.id,
					rest,
					"this_campaign",
				);
				result = result ? mergeResults(result, more) : more;
			}
			return { campaign: created.campaign, result };
		},
		onSuccess: async ({ campaign, result }) => {
			await cache.everything();
			toast.success(
				`“${campaign.name}” created${result ? `: ${leadsSummary(result)}` : ""}.`,
			);
			router.push(href(`/outreach/campaigns/${unifersRouteId(campaign.id)}`));
		},
		onError: (error) => toast.error(error.message),
		onSettled: () => setProgress(""),
	});

	const sequenceReady = steps.every(
		(step) => step.subject.trim() !== "" && step.body.trim() !== "",
	);
	const windowReady = days.length > 0 && windowStart < windowEnd;
	const launchReady =
		launch === "draft" ||
		launch === "now" ||
		(scheduleAt !== "" && new Date(scheduleAt).getTime() > Date.now());
	const ready =
		name.trim() !== "" && sequenceReady && windowReady && launchReady;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>1. Name and audience</CardTitle>
					<CardDescription>
						The audience is one of your Outreach lists. Its active contacts
						become the campaign's leads. Unsubscribed, bounced and suppressed
						people are left out.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={ids.name}>Campaign name</FieldLabel>
							<Input
								id={ids.name}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Q4 founders outreach"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.list}>Audience</FieldLabel>
							<Select value={listId} onValueChange={setListId}>
								<SelectTrigger id={ids.list}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_LIST}>
										No audience now (add leads later)
									</SelectItem>
									{(lists.data?.data ?? []).map((list) => (
										<SelectItem key={list.id} value={list.id}>
											{list.name} ({COUNT.format(list.contactCount)})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								{lists.isError
									? "Outreach audiences are not reachable. You can still create the campaign and add leads later from Lead generation → Leads."
									: "Add more later from Lead generation → Leads → Send with Unifers."}
							</FieldDescription>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>2. Emails</CardTitle>
					<CardDescription>
						The first email goes out when the lead is added; each follow-up
						waits the days you set. Placeholders are filled by Unifers; the part
						after | is used when a value is missing.
					</CardDescription>
					<CardAction>
						<Button
							variant="outline"
							size="sm"
							disabled={steps.length >= UNIFERS.maxSteps}
							onClick={() =>
								setSteps((current) => [
									...current,
									{
										subject: `Re: ${current[0]?.subject ?? ""}`,
										body: "",
										waitDays: UNIFERS.followUpWaitDays,
									},
								])
							}
						>
							Add follow-up
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<CampaignWriter
						list={
							chosenList ? { id: chosenList.id, name: chosenList.name } : null
						}
						stepCount={steps.length}
						written={written}
						onDrafted={applyDraft}
					/>
					<Field orientation="horizontal">
						<Checkbox
							id={ids.signOff}
							checked={signOff}
							onCheckedChange={(checked) => setSignOff(checked === true)}
						/>
						<FieldLabel htmlFor={ids.signOff}>
							Sign every email with the sending mailbox's name
						</FieldLabel>
					</Field>
					{steps.map((step, index) => (
						<StepEditor
							key={`step-${index.toString()}`}
							index={index}
							step={step}
							signOff={signOff}
							onChange={(next) => updateStep(index, next)}
							onRemove={
								index === 0
									? undefined
									: () =>
											setSteps((current) =>
												current.filter((_, i) => i !== index),
											)
							}
						/>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>3. Senders</CardTitle>
					<CardDescription>
						Unifers rotates through the mailboxes you tick. Tick none to use
						your default mailbox. Only verified mailboxes can send.
					</CardDescription>
					{isAdmin ? (
						<CardAction>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setConnectOpen(true)}
							>
								Connect mailbox
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{mailboxes.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No Unifers mailbox yet.{" "}
							{isAdmin
								? "Connect one first."
								: "Ask an owner or admin to connect one."}
						</p>
					) : (
						mailboxes.map((mailbox) => {
							const status = UNIFERS_ACCOUNT_STATUS[mailbox.status];
							const checkboxId = `${ids.name}-${mailbox.email}`;
							return (
								<Field key={mailbox.email} orientation="horizontal">
									<Checkbox
										id={checkboxId}
										checked={senders.includes(mailbox.email)}
										disabled={mailbox.status !== "verified"}
										onCheckedChange={(checked) =>
											setSenders((current) =>
												checked === true
													? [...current, mailbox.email]
													: current.filter((email) => email !== mailbox.email),
											)
										}
									/>
									<FieldLabel htmlFor={checkboxId}>
										{mailbox.fromName
											? `${mailbox.fromName} <${mailbox.email}>`
											: mailbox.email}
										{mailbox.isDefault ? " · default" : ""}
									</FieldLabel>
									<StatusIndicator
										tone={status.tone}
										label={status.label}
										size="sm"
									/>
								</Field>
							);
						})
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>4. Sending window</CardTitle>
					<CardDescription>
						Emails go out only inside this window. It cannot cross midnight.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-3">
							<Field>
								<FieldLabel htmlFor={ids.start}>From</FieldLabel>
								<Input
									id={ids.start}
									type="time"
									value={windowStart}
									onChange={(event) => setWindowStart(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={ids.end}>Until</FieldLabel>
								<Input
									id={ids.end}
									type="time"
									value={windowEnd}
									onChange={(event) => setWindowEnd(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={ids.zone}>Time zone</FieldLabel>
								<Input
									id={ids.zone}
									value={timeZone}
									onChange={(event) => setTimeZone(event.target.value)}
								/>
							</Field>
						</div>
						<div className="flex flex-wrap gap-4">
							{WEEKDAYS.map((day) => (
								<Field
									key={day.value}
									orientation="horizontal"
									className="w-auto"
								>
									<Checkbox
										id={`${ids.start}-${day.value}`}
										checked={days.includes(day.value)}
										onCheckedChange={(checked) =>
											setDays((current) =>
												checked === true
													? [...current, day.value].sort()
													: current.filter((value) => value !== day.value),
											)
										}
									/>
									<FieldLabel htmlFor={`${ids.start}-${day.value}`}>
										{day.label}
									</FieldLabel>
								</Field>
							))}
						</div>
						<div className="flex flex-wrap gap-6">
							<Field orientation="horizontal" className="w-auto">
								<Checkbox
									id={`${ids.end}-reply`}
									checked={stopOnReply}
									onCheckedChange={(checked) =>
										setStopOnReply(checked === true)
									}
								/>
								<FieldLabel htmlFor={`${ids.end}-reply`}>
									Stop for a lead who replies
								</FieldLabel>
							</Field>
							<Field orientation="horizontal" className="w-auto">
								<Checkbox
									id={`${ids.end}-click`}
									checked={stopOnClick}
									onCheckedChange={(checked) =>
										setStopOnClick(checked === true)
									}
								/>
								<FieldLabel htmlFor={`${ids.end}-click`}>
									Stop for a lead who clicks a link
								</FieldLabel>
							</Field>
						</div>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>5. Create</CardTitle>
					<CardDescription>
						{isAdmin
							? "Save it as a draft, start it now, or schedule it."
							: "Save it as a draft. An owner or admin starts or schedules it."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						{isAdmin ? (
							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel htmlFor={ids.when}>When</FieldLabel>
									<Select
										value={launch}
										onValueChange={(next) => {
											if (
												next === "draft" ||
												next === "now" ||
												next === "schedule"
											)
												setLaunch(next);
										}}
									>
										<SelectTrigger id={ids.when}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="draft">Save as draft</SelectItem>
											<SelectItem value="now">Start now</SelectItem>
											<SelectItem value="schedule">Schedule</SelectItem>
										</SelectContent>
									</Select>
								</Field>
								{launch === "schedule" ? (
									<Field>
										<FieldLabel htmlFor={`${ids.when}-at`}>Start at</FieldLabel>
										<Input
											id={`${ids.when}-at`}
											type="datetime-local"
											value={scheduleAt}
											onChange={(event) => setScheduleAt(event.target.value)}
										/>
									</Field>
								) : null}
							</div>
						) : null}
						{progress ? (
							<p className="text-muted-foreground text-sm">{progress}</p>
						) : null}
						<div>
							<Button
								disabled={!ready || create.isPending}
								onClick={() => create.mutate()}
							>
								{launch === "now"
									? "Create and start"
									: launch === "schedule"
										? "Create and schedule"
										: "Create draft"}
							</Button>
						</div>
					</FieldGroup>
				</CardContent>
			</Card>

			<ConnectMailboxDialog
				open={connectOpen}
				onClose={() => setConnectOpen(false)}
			/>
		</div>
	);
}

function StepEditor({
	index,
	step,
	signOff,
	onChange,
	onRemove,
}: {
	index: number;
	step: SequenceStep;
	signOff: boolean;
	onChange: (next: Partial<SequenceStep>) => void;
	onRemove?: () => void;
}) {
	const id = useId();
	return (
		<FieldGroup>
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-sm">
					{index === 0 ? "First email" : `Follow-up ${index}`}
				</p>
				{onRemove ? (
					<Button variant="ghost" size="sm" onClick={onRemove}>
						Remove
					</Button>
				) : null}
			</div>
			{index > 0 ? (
				<Field>
					<FieldLabel htmlFor={`${id}-wait`}>Wait (days)</FieldLabel>
					<Input
						id={`${id}-wait`}
						type="number"
						min={0.5}
						step={0.5}
						value={step.waitDays}
						onChange={(event) =>
							onChange({ waitDays: Number(event.target.value) })
						}
					/>
				</Field>
			) : null}
			<Field>
				<FieldLabel htmlFor={`${id}-subject`}>Subject</FieldLabel>
				<Input
					id={`${id}-subject`}
					value={step.subject}
					onChange={(event) => onChange({ subject: event.target.value })}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${id}-body`}>Body</FieldLabel>
				<Textarea
					id={`${id}-body`}
					rows={7}
					value={step.body}
					onChange={(event) => onChange({ body: event.target.value })}
				/>
				{signOff && !step.body.includes(UNIFERS.senderPlaceholder) ? (
					<FieldDescription>
						Ends with “Regards, {"{{sender.firstName}}"}”. Unifers fills in the
						first name of the mailbox that sends it.
					</FieldDescription>
				) : null}
				<div className="flex flex-wrap gap-2">
					{UNIFERS.placeholders.map((placeholder) => (
						<Button
							key={placeholder}
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onChange({ body: `${step.body}${placeholder}` })}
						>
							{placeholder}
						</Button>
					))}
				</div>
			</Field>
		</FieldGroup>
	);
}
