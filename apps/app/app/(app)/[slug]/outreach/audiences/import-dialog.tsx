"use client";

import CheckmarkOutline from "@carbon/icons-react/es/CheckmarkOutline";
import Download from "@carbon/icons-react/es/Download";
import Link from "@carbon/icons-react/es/Link";
import { Button } from "@crm/ui/components/button";
import { Card } from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
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
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { StatCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	destinationOf,
	EMPTY_LINK_TARGET,
	type LinkTarget,
	LinkTargetFields,
	LocalLinksBanner,
	useTrackingConfig,
} from "@/components/outreach/tracking-links";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import {
	COLUMN_TARGETS,
	type ColumnMapping,
	customKey,
	FIELD_LABELS,
	IMPORT_LIMITS,
	looksLikeEmail,
	mappingProblem,
} from "@/lib/outreach/contact-fields";
import { downloadFromOutreach } from "@/lib/outreach/download";
import { COUNT, keyed } from "@/lib/outreach/format";
import type {
	ImportPreview,
	ImportReport,
} from "@/lib/outreach/schemas/audience";

const STEPS = [
	"Upload",
	"Map columns",
	"Preview",
	"List & links",
	"Result",
] as const;
type Step = 0 | 1 | 2 | 3 | 4;
const LIST_PICKER_LIMIT = 100;

export function ImportDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
				{open ? <ImportFlow onClose={() => onOpenChange(false)} /> : null}
			</DialogContent>
		</Dialog>
	);
}

function ImportFlow({ onClose }: { onClose: () => void }) {
	const fileId = useId();
	const newListId = useId();
	const cache = useOutreachCache();
	const config = useTrackingConfig();
	const [step, setStep] = useState<Step>(0);
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<ImportPreview | null>(null);
	const [mapping, setMapping] = useState<ColumnMapping>({});
	const [listMode, setListMode] = useState<"existing" | "new">("existing");
	const [listId, setListId] = useState<string | null>(null);
	const [newListName, setNewListName] = useState("");
	const [makeLinks, setMakeLinks] = useState(true);
	const [linkTarget, setLinkTarget] = useState<LinkTarget>(EMPTY_LINK_TARGET);
	const [report, setReport] = useState<{
		listId: string;
		result: ImportReport;
	} | null>(null);

	const lists = useQuery({
		queryKey: [...outreachKeys.lists, "picker"],
		queryFn: () => audienceApi.lists({ page: 1, limit: LIST_PICKER_LIMIT }),
	});

	const homepage = config.data?.homepage ?? "";
	const problem = mappingProblem(mapping);
	const emailColumn = Object.keys(mapping).find(
		(column) => mapping[column] === "email",
	);

	const read = useMutation({
		mutationFn: (selected: File) => audienceApi.previewImport(selected),
		onSuccess: (result) => {
			setPreview(result);
			setMapping(result.suggestedMapping);
			setStep(1);
		},
		onError: (error) => toast.error(error.message),
	});

	const run = useMutation({
		mutationFn: async () => {
			if (!file) throw new Error("Choose a CSV file first.");
			let target = listId;
			if (listMode === "new") {
				const created = await audienceApi.createList({
					name: newListName.trim(),
				});
				target = created.id;
			}
			if (!target) throw new Error("Choose a list.");
			const result = await audienceApi.confirmImport({
				file,
				listId: target,
				mapping,
				linkDestinationUrl:
					makeLinks && homepage
						? destinationOf(linkTarget.path, homepage)
						: undefined,
				linkDomainId: makeLinks ? linkTarget.domainId || undefined : undefined,
			});
			return { listId: target, result };
		},
		onSuccess: async (done) => {
			await cache.audience();
			setReport(done);
			setStep(4);
		},
		onError: (error) => toast.error(error.message),
	});

	const download = useMutation({
		mutationFn: () => {
			const links = report?.result.links;
			if (!report || !links) throw new Error("No links were made.");
			return downloadFromOutreach(`/lists/${report.listId}/links.csv`, {
				destinationUrl: links.destinationUrl,
				domainId: links.domainId ?? undefined,
			});
		},
		onSuccess: (filename) => toast.success(`Saved ${filename}.`),
		onError: (error) => toast.error(error.message),
	});

	const listReady =
		listMode === "existing" ? Boolean(listId) : newListName.trim().length > 0;

	return (
		<>
			<DialogHeader>
				<DialogTitle>Import contacts from CSV</DialogTitle>
				<DialogDescription>
					{STEPS.map((label, index) => (
						<span
							key={label}
							className={
								index === step ? "mr-3 font-medium text-foreground" : "mr-3"
							}
						>
							{index + 1}. {label}
						</span>
					))}
				</DialogDescription>
			</DialogHeader>

			{step === 0 ? (
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor={fileId}>CSV file</FieldLabel>
						<Input
							id={fileId}
							type="file"
							accept=".csv,text/csv"
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						/>
						<FieldDescription>
							At most {IMPORT_LIMITS.maxLabel}. The first row must hold the
							column names. From Excel or Google Sheets, save or download as
							CSV.
						</FieldDescription>
					</Field>
					<DialogFooter>
						<Button
							disabled={!file || read.isPending}
							onClick={() => {
								if (!file) return;
								if (file.size > IMPORT_LIMITS.maxBytes) {
									toast.error(
										"The file is larger than 5 MB. Split it into smaller files.",
									);
									return;
								}
								read.mutate(file);
							}}
						>
							{read.isPending ? "Reading file…" : "Next"}
						</Button>
					</DialogFooter>
				</div>
			) : null}

			{step === 1 && preview ? (
				<div className="flex flex-col gap-4">
					<p className="text-muted-foreground text-xs">
						{COUNT.format(preview.totalRows)} rows found. Tell Outreach what
						each column holds. Other columns become custom fields you can use in
						emails as {"{{custom.name}}"}.
					</p>
					<SimpleTable
						columns={[
							{ id: "column", header: "Column in your file" },
							{ id: "example", header: "Example" },
							{ id: "target", header: "Import as", width: "w-56" },
						]}
					>
						{preview.columns.map((column) => (
							<SimpleTableRow key={column}>
								<TableCell className="px-3 font-medium">{column}</TableCell>
								<TableCell className="max-w-48 truncate px-3 text-muted-foreground text-xs">
									{preview.rows.find((row) => row[column])?.[column] ?? "—"}
								</TableCell>
								<TableCell className="px-3">
									<Select
										value={mapping[column] ?? "skip"}
										onValueChange={(next) => {
											const target = COLUMN_TARGETS.find(
												(value) => value === next,
											);
											if (target)
												setMapping((current) => ({
													...current,
													[column]: target,
												}));
										}}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{COLUMN_TARGETS.map((target) => (
												<SelectItem key={target} value={target}>
													{FIELD_LABELS[target]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{mapping[column] === "custom" ? (
										<p className="mt-1 text-muted-foreground text-xs">
											{`{{custom.${customKey(column)}}}`}
										</p>
									) : null}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
					{problem ? (
						<p className="text-destructive text-xs">{problem}</p>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setStep(0)}>
							Back
						</Button>
						<Button disabled={Boolean(problem)} onClick={() => setStep(2)}>
							Next
						</Button>
					</DialogFooter>
				</div>
			) : null}

			{step === 2 && preview && emailColumn ? (
				<PreviewStep
					preview={preview}
					mapping={mapping}
					emailColumn={emailColumn}
					onBack={() => setStep(1)}
					onNext={() => setStep(3)}
				/>
			) : null}

			{step === 3 ? (
				<div className="flex flex-col gap-4">
					<ToggleGroup
						type="single"
						variant="outline"
						value={listMode}
						onValueChange={(next) =>
							next === "existing" || next === "new"
								? setListMode(next)
								: undefined
						}
						size="sm"
						spacing={1}
					>
						<ToggleGroupItem value="existing">
							Add to an existing list
						</ToggleGroupItem>
						<ToggleGroupItem value="new">Create a new list</ToggleGroupItem>
					</ToggleGroup>

					{listMode === "existing" ? (
						<Field>
							<FieldLabel>List</FieldLabel>
							<Select value={listId ?? undefined} onValueChange={setListId}>
								<SelectTrigger>
									<SelectValue
										placeholder={
											lists.data?.data.length
												? "Choose a list"
												: "No lists yet. Create one."
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{(lists.data?.data ?? []).map((list) => (
										<SelectItem key={list.id} value={list.id}>
											{list.name} ({COUNT.format(list.contactCount)})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					) : (
						<Field>
							<FieldLabel htmlFor={newListId}>New list name</FieldLabel>
							<Input
								id={newListId}
								placeholder="e.g. SaaS founders – Oct 2026"
								value={newListName}
								onChange={(event) => setNewListName(event.target.value)}
							/>
						</Field>
					)}
					<p className="text-muted-foreground text-xs">
						Contacts that already exist are not duplicated. They join this list,
						and only their empty fields are filled. Addresses on the suppression
						list are marked and never emailed.
					</p>

					<div className="flex flex-col gap-4 rounded-lg border p-4">
						<Field orientation="horizontal">
							<Checkbox
								checked={makeLinks}
								onCheckedChange={(checked) => setMakeLinks(checked === true)}
								aria-label="Make a tracking link for every contact"
							/>
							<FieldLabel className="flex items-center gap-1.5">
								<Icon icon={Link} />
								Make a tracking link for every contact
							</FieldLabel>
						</Field>
						{makeLinks ? (
							<>
								<LocalLinksBanner />
								<FieldGroup>
									<LinkTargetFields
										value={linkTarget}
										onChange={setLinkTarget}
										config={config.data}
									/>
								</FieldGroup>
							</>
						) : null}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setStep(2)}>
							Back
						</Button>
						<Button
							disabled={!listReady || run.isPending || (makeLinks && !homepage)}
							onClick={() => run.mutate()}
						>
							{run.isPending
								? "Importing…"
								: `Import ${COUNT.format(preview?.totalRows ?? 0)} rows`}
						</Button>
					</DialogFooter>
				</div>
			) : null}

			{step === 4 && report ? (
				<div className="flex flex-col gap-4">
					<p className="flex items-center gap-2 font-medium text-sm">
						<Icon icon={CheckmarkOutline} className="text-success" />
						Import finished
					</p>
					<Card>
						<div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3">
							<StatCard
								label="Rows in file"
								value={COUNT.format(report.result.total)}
							/>
							<StatCard
								label="New contacts"
								value={COUNT.format(report.result.created)}
							/>
							<StatCard
								label="Already existed"
								value={COUNT.format(report.result.updated)}
							/>
							<StatCard
								label="Duplicates in file"
								value={COUNT.format(report.result.duplicatesInFile)}
							/>
							<StatCard
								label="Invalid (skipped)"
								value={COUNT.format(report.result.invalid)}
							/>
							<StatCard
								label="On suppression list"
								value={COUNT.format(report.result.suppressed)}
							/>
						</div>
					</Card>

					{report.result.links ? (
						<div className="flex flex-col gap-3 rounded-lg border p-4 text-xs">
							<p className="flex items-center gap-2 font-medium">
								<Icon icon={Link} />
								{COUNT.format(report.result.links.total)} contacts in the list
								have a tracking link (
								{COUNT.format(report.result.links.created)} new)
							</p>
							<p className="break-all font-mono text-muted-foreground">
								{report.result.links.baseUrl}/r/… →{" "}
								{report.result.links.destinationUrl}
							</p>
							<Button
								className="w-fit"
								disabled={download.isPending}
								onClick={() => download.mutate()}
							>
								<Icon icon={Download} data-icon="inline-start" />
								{download.isPending ? "Preparing…" : "Download links (CSV)"}
							</Button>
						</div>
					) : null}

					{report.result.invalidRows.length > 0 ? (
						<div className="flex flex-col gap-2">
							<p className="font-medium text-xs">
								Invalid rows
								{report.result.invalid > report.result.invalidRows.length
									? " (first 100)"
									: ""}
							</p>
							<ul className="max-h-48 overflow-y-auto rounded-lg border text-xs">
								{report.result.invalidRows.map((row) => (
									<li
										key={row.row}
										className="flex gap-3 border-b px-3 py-1.5 last:border-0"
									>
										<span className="w-16 text-muted-foreground">
											Row {row.row}
										</span>
										<span className="flex-1 truncate font-mono">
											{row.email || "(empty)"}
										</span>
										<span className="text-muted-foreground">{row.reason}</span>
									</li>
								))}
							</ul>
						</div>
					) : null}

					<DialogFooter>
						<Button onClick={onClose}>Done</Button>
					</DialogFooter>
				</div>
			) : null}
		</>
	);
}

function PreviewStep({
	preview,
	mapping,
	emailColumn,
	onBack,
	onNext,
}: {
	preview: ImportPreview;
	mapping: ColumnMapping;
	emailColumn: string;
	onBack: () => void;
	onNext: () => void;
}) {
	const columnFor = (field: string) =>
		Object.keys(mapping).find((column) => mapping[column] === field);
	const customColumns = Object.keys(mapping).filter(
		(column) => mapping[column] === "custom",
	);
	const fields = [
		["Email", emailColumn],
		["First name", columnFor("firstName")],
		["Last name", columnFor("lastName")],
		["Company", columnFor("company")],
		["Job title", columnFor("title")],
	] as const;
	const invalid = preview.rows.filter(
		(row) => !looksLikeEmail(row[emailColumn] ?? ""),
	).length;

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground text-xs">
				First {preview.rows.length} of {COUNT.format(preview.totalRows)} rows.
				{customColumns.length > 0
					? ` Plus ${customColumns.length} custom field${customColumns.length === 1 ? "" : "s"}.`
					: ""}
				{invalid > 0
					? ` ${invalid} of these rows have an invalid email and will be skipped.`
					: ""}
			</p>
			<div className="max-h-80 overflow-auto">
				<SimpleTable
					columns={fields.map(([label]) => ({ id: label, header: label }))}
				>
					{keyed(preview.rows, "row").map(({ id, item: row }) => {
						const bad = !looksLikeEmail(row[emailColumn] ?? "");
						return (
							<SimpleTableRow key={id}>
								{fields.map(([label, column]) => (
									<TableCell
										key={label}
										className={
											bad && label === "Email"
												? "max-w-40 truncate px-3 text-destructive"
												: "max-w-40 truncate px-3"
										}
									>
										{column ? row[column] || "—" : "—"}
									</TableCell>
								))}
							</SimpleTableRow>
						);
					})}
				</SimpleTable>
			</div>
			<DialogFooter>
				<Button variant="outline" onClick={onBack}>
					Back
				</Button>
				<Button onClick={onNext}>Next</Button>
			</DialogFooter>
		</div>
	);
}
