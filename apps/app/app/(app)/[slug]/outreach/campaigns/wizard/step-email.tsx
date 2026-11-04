"use client";

import Add from "@carbon/icons-react/es/Add";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Skeleton } from "@crm/ui/components/skeleton";
import { Textarea } from "@crm/ui/components/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { CampaignTestSendDialog } from "@/components/outreach/campaign-test-send-dialog";
import { ReadinessPanel } from "@/components/outreach/readiness-panel";
import { audienceApi, campaignApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { CAMPAIGN, VARIABLE_LABELS } from "@/lib/outreach/campaign-rules";
import { keyed, personName } from "@/lib/outreach/format";
import type { CampaignVariant } from "@/lib/outreach/schemas/campaign";
import type {
	ReadinessFix,
	ReadinessItem,
} from "@/lib/outreach/schemas/readiness";
import { useDebounced } from "@/lib/outreach/use-debounced";
import {
	applyFix,
	emailFields,
	parseWords,
	versionLabel,
	versionsOf,
	type WizardForm,
} from "@/lib/outreach/wizard";

type EditorField = "subjectTemplate" | "bodyTemplate" | "bodyHtml";

const AUTO_CONTACT = "auto";
const NO_COLUMN = "none";

export function StepEmail({
	campaignId,
	form,
	onChange,
	viewerEmail,
}: {
	campaignId: string;
	form: WizardForm;
	onChange: (patch: Partial<WizardForm>) => void;
	viewerEmail: string;
}) {
	const queryClient = useQueryClient();
	const subjectId = useId();
	const bodyId = useId();
	const nameId = useId();
	const wordsId = useId();
	const subjectRef = useRef<HTMLInputElement>(null);
	const bodyRef = useRef<HTMLTextAreaElement>(null);
	const htmlRef = useRef<HTMLTextAreaElement>(null);
	const lastField = useRef<EditorField>("bodyTemplate");
	const [contactId, setContactId] = useState(AUTO_CONTACT);
	const [active, setActive] = useState(0);
	const [testOpen, setTestOpen] = useState(false);

	const isFollowUp = form.followUpOf !== null;
	const versions = versionsOf(form);
	const current =
		versions[Math.min(active, versions.length - 1)] ?? versions[0];

	const saved = useDebounced(
		JSON.stringify(emailFields(form)),
		CAMPAIGN.autosaveDebounceMs,
	);
	const readinessKey = [...outreachKeys.campaign(campaignId), "readiness"];
	const lastSaved = useRef(saved);

	useEffect(() => {
		if (saved === lastSaved.current) return;
		lastSaved.current = saved;
		void campaignApi
			.update(campaignId, emailFields(form))
			.then(() => queryClient.invalidateQueries({ queryKey: readinessKey }))
			.catch(() => undefined);
	});

	const readiness = useQuery({
		queryKey: readinessKey,
		queryFn: () => campaignApi.readiness(campaignId),
	});

	const contacts = useQuery({
		queryKey: [...outreachKeys.contacts, "preview", form.listId],
		queryFn: () =>
			audienceApi.contacts({
				page: 1,
				limit: CAMPAIGN.previewContacts,
				listId: form.listId ?? undefined,
			}),
		enabled: Boolean(form.listId),
	});

	const previewInput = useDebounced(
		{
			contactId: contactId === AUTO_CONTACT ? undefined : contactId,
			subjectTemplate: current?.subjectTemplate ?? "",
			bodyTemplate: current?.bodyTemplate ?? "",
			bodyHtml: current?.bodyHtml ?? null,
		},
		CAMPAIGN.previewDebounceMs,
	);
	const preview = useQuery({
		queryKey: [...outreachKeys.campaign(campaignId), "preview", previewInput],
		queryFn: () => campaignApi.preview(campaignId, previewInput),
		placeholderData: (previous) => previous,
	});

	const customVariables = preview.data?.customVariables ?? [];
	const variables = [
		...CAMPAIGN.standardVariables,
		...CAMPAIGN.senderVariables,
		...customVariables,
	].filter((name) => isFollowUp || name !== "originalSubject");

	function updateVersion(index: number, patch: Partial<CampaignVariant>) {
		if (index === 0) {
			const { name, ...rest } = patch;
			const next: Partial<WizardForm> = { ...rest };
			if (name !== undefined) next.templateName = name;
			onChange(next);
			return;
		}
		onChange({
			variants: form.variants.map((variant, position) =>
				position === index - 1 ? { ...variant, ...patch } : variant,
			),
		});
	}

	const setCurrent = (patch: Partial<CampaignVariant>) =>
		updateVersion(active, patch);

	function fieldRef(field: EditorField) {
		return field === "subjectTemplate"
			? subjectRef.current
			: field === "bodyTemplate"
				? bodyRef.current
				: htmlRef.current;
	}

	function highlight(field: EditorField, text: string) {
		window.setTimeout(() => {
			const element = fieldRef(field);
			if (!element) return;
			const at = text ? element.value.indexOf(text) : -1;
			element.focus();
			element.scrollIntoView({ block: "center", behavior: "smooth" });
			if (at >= 0) element.setSelectionRange(at, at + text.length);
		}, 50);
	}

	function fix(item: ReadinessItem, readinessFix: ReadinessFix) {
		if (
			readinessFix.kind !== "insert" &&
			readinessFix.kind !== "replace" &&
			readinessFix.kind !== "show"
		)
			return;
		const index = Math.min(item.template ?? active, versions.length - 1);
		if (index !== active) setActive(index);
		const version = versions[index];
		if (!version) return;
		if (readinessFix.kind === "show") {
			highlight(readinessFix.field, readinessFix.find);
			return;
		}
		if (readinessFix.field === "bodyHtml" && version.bodyHtml === null) return;
		updateVersion(index, {
			[readinessFix.field]: applyFix(
				version[readinessFix.field] ?? "",
				readinessFix,
			),
		});
		const added =
			readinessFix.kind === "insert" ? readinessFix.text : readinessFix.replace;
		highlight(readinessFix.field, added.trim().split("\n")[0] ?? "");
	}

	function insertVariable(name: string) {
		if (!current) return;
		const field = lastField.current;
		const element = fieldRef(field);
		const value = current[field] ?? "";
		const token = `{{${name}}}`;
		const start = element?.selectionStart ?? value.length;
		const end = element?.selectionEnd ?? value.length;
		setCurrent({ [field]: value.slice(0, start) + token + value.slice(end) });
		requestAnimationFrame(() => {
			element?.focus();
			element?.setSelectionRange(start + token.length, start + token.length);
		});
	}

	function addVersion() {
		onChange({
			variants: [
				...form.variants,
				{
					name: "",
					subjectTemplate: "",
					bodyTemplate: `Hi {{firstName}},\n\n\n\n${CAMPAIGN.optOutLine}`,
					bodyHtml: null,
					matchValues: [],
				},
			],
		});
		setActive(form.variants.length + 1);
	}

	function removeVersion() {
		onChange({
			variants: form.variants.filter((_, index) => index !== active - 1),
		});
		setActive(0);
	}

	if (!current) return null;

	const columnOptions = ["title", "company", ...customVariables];

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<div className="flex flex-col gap-5">
				{!isFollowUp ? (
					<div className="flex flex-col gap-2 rounded-lg border p-3">
						<div className="flex flex-wrap items-center gap-1.5">
							<span className="mr-1 font-medium text-xs">Versions</span>
							{keyed(versions, "version").map(
								({ id, item: version, position }) => (
									<Button
										key={id}
										size="xs"
										variant={position === active ? "default" : "outline"}
										onClick={() => setActive(position)}
									>
										{versionLabel(version, position)}
									</Button>
								),
							)}
							{versions.length < CAMPAIGN.maxVersions ? (
								<Button size="xs" variant="ghost" onClick={addVersion}>
									<Icon icon={Add} data-icon="inline-start" />
									Add version
								</Button>
							) : null}
						</div>
						<p className="text-muted-foreground text-xs">
							Optional: different emails for different kinds of contacts. Each
							contact gets the version whose words appear in the chosen column;
							everyone else gets them in turn.
						</p>
						{versions.length > 1 ? (
							<Field>
								<FieldLabel>Pick the version by this contact column</FieldLabel>
								<Select
									value={form.variantColumn || NO_COLUMN}
									onValueChange={(value) =>
										onChange({
											variantColumn: value === NO_COLUMN ? "" : value,
										})
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NO_COLUMN}>
											None — versions take turns
										</SelectItem>
										{columnOptions.map((column) => (
											<SelectItem key={column} value={column}>
												{column}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						) : null}
					</div>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor={nameId}>Template name</FieldLabel>
						<Input
							id={nameId}
							value={current.name}
							maxLength={200}
							placeholder={active === 0 ? form.name : ""}
							onChange={(event) => setCurrent({ name: event.target.value })}
						/>
						<FieldDescription>
							Shown in the logs. Empty uses the campaign name.
						</FieldDescription>
					</Field>
					{versions.length > 1 ? (
						<Field>
							<FieldLabel htmlFor={wordsId}>
								Words that pick this version
							</FieldLabel>
							<Input
								id={wordsId}
								key={`words-${active}`}
								defaultValue={current.matchValues.join(", ")}
								placeholder="comma separated"
								onBlur={(event) =>
									setCurrent({ matchValues: parseWords(event.target.value) })
								}
							/>
						</Field>
					) : null}
				</div>

				<Field>
					<FieldLabel htmlFor={subjectId}>Subject</FieldLabel>
					<Input
						id={subjectId}
						ref={subjectRef}
						value={current.subjectTemplate}
						maxLength={CAMPAIGN.maxSubjectLength}
						onFocus={() => {
							lastField.current = "subjectTemplate";
						}}
						onChange={(event) =>
							setCurrent({ subjectTemplate: event.target.value })
						}
					/>
					{isFollowUp ? (
						<FieldDescription>
							Use {"{{originalSubject}}"}. In Outlook format the follow-up is a
							real reply, and Microsoft makes the subject “RE: first subject”.
						</FieldDescription>
					) : null}
				</Field>

				<div className="flex flex-col gap-2">
					<span className="font-medium text-xs">Insert a variable</span>
					<div className="flex flex-wrap gap-1.5">
						{variables.map((name) => (
							<Button
								key={name}
								variant="outline"
								size="xs"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => insertVariable(name)}
							>
								{VARIABLE_LABELS.get(name) ?? name}
							</Button>
						))}
					</div>
					<p className="text-muted-foreground text-xs">
						Click to insert at the cursor. Add a fallback with a bar, for
						example {"{{firstName|there}}"}. Without a fallback, a contact
						missing that value is skipped, so nobody gets “Hi ,”. Your name and
						role come from the inbox settings.
					</p>
					<p className="text-muted-foreground text-xs">
						Spintax: write {"{Hi|Hello|Hey}"} and each person gets one option.
						The same person always gets the same words.
					</p>
				</div>

				<Field>
					<FieldLabel htmlFor={bodyId}>Email (plain text)</FieldLabel>
					<Textarea
						id={bodyId}
						ref={bodyRef}
						rows={14}
						value={current.bodyTemplate}
						maxLength={CAMPAIGN.maxBodyLength}
						onFocus={() => {
							lastField.current = "bodyTemplate";
						}}
						onChange={(event) =>
							setCurrent({ bodyTemplate: event.target.value })
						}
						className="font-mono"
					/>
					<FieldDescription>
						No tracking pixel, at most one link. The checks on the right update
						a moment after you stop typing.
					</FieldDescription>
				</Field>

				<Field orientation="horizontal">
					<Checkbox
						checked={current.bodyHtml !== null}
						onCheckedChange={(checked) =>
							setCurrent({ bodyHtml: checked === true ? "" : null })
						}
						aria-label="Write my own HTML version"
					/>
					<FieldLabel>Write my own HTML version</FieldLabel>
				</Field>
				{current.bodyHtml === null ? (
					<p className="-mt-3 text-muted-foreground text-xs">
						Off: the text above is laid out like an email typed in Outlook.
					</p>
				) : (
					<Textarea
						ref={htmlRef}
						rows={10}
						value={current.bodyHtml}
						maxLength={CAMPAIGN.maxBodyLength}
						placeholder='<div style="font-family: Calibri, Arial, sans-serif;">…</div>'
						onFocus={() => {
							lastField.current = "bodyHtml";
						}}
						onChange={(event) => setCurrent({ bodyHtml: event.target.value })}
						className="font-mono"
						aria-label="HTML version"
					/>
				)}

				{active > 0 ? (
					<Button variant="outline" className="w-fit" onClick={removeVersion}>
						<Icon icon={TrashCan} data-icon="inline-start" />
						Remove this version
					</Button>
				) : null}
			</div>

			<div className="flex flex-col gap-3">
				<ReadinessPanel
					title="Outlook readiness"
					items={readiness.data?.saved ?? []}
					versionNames={versions.map(versionLabel)}
					loading={readiness.isPending}
					onFix={fix}
					onSendTest={() => setTestOpen(true)}
				/>

				<Field>
					<FieldLabel>Preview as</FieldLabel>
					<Select value={contactId} onValueChange={setContactId}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={AUTO_CONTACT}>
								First contact in the list
							</SelectItem>
							{(contacts.data?.data ?? []).map((contact) => (
								<SelectItem key={contact.id} value={contact.id}>
									{personName(contact)} · {contact.email}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>

				<div className="rounded-lg border text-xs">
					{preview.isError ? (
						<p className="p-4 text-destructive">{preview.error.message}</p>
					) : !preview.data ? (
						<div className="flex flex-col gap-2 p-4">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<>
							<div className="flex flex-col gap-1 border-b p-4">
								<p>
									<span className="text-muted-foreground">To: </span>
									{preview.data.contact?.email ?? "(no contact)"}
								</p>
								<p>
									<span className="text-muted-foreground">Subject: </span>
									<span className="font-medium">
										{preview.data.subject || "(empty)"}
									</span>
								</p>
							</div>
							<p className="whitespace-pre-wrap p-4">
								{preview.data.text || (
									<span className="text-muted-foreground">(empty)</span>
								)}
							</p>
							{preview.data.html ? (
								<iframe
									title="HTML version"
									sandbox=""
									srcDoc={preview.data.html}
									className="h-72 w-full border-t bg-background"
								/>
							) : null}
						</>
					)}
				</div>

				{preview.data && preview.data.warnings.length > 0 ? (
					<Alert variant="warning">
						<Icon icon={Warning} />
						<AlertTitle>Check before sending</AlertTitle>
						<AlertDescription>
							<ul className="list-disc pl-4">
								{preview.data.warnings.map((warning) => (
									<li key={warning}>{warning}</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				) : preview.data ? (
					<p className="text-muted-foreground text-xs">
						No problems found for this contact.
					</p>
				) : null}
			</div>

			<CampaignTestSendDialog
				campaignId={campaignId}
				inboxes={readiness.data?.inboxes ?? []}
				versionNames={versions.map(versionLabel)}
				defaultTo={viewerEmail}
				open={testOpen}
				onOpenChange={setTestOpen}
			/>
		</div>
	);
}
