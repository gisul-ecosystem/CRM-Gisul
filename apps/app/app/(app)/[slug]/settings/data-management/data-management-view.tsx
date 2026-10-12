"use client";

import Add from "@carbon/icons-react/es/Add";
import CloudDownload from "@carbon/icons-react/es/CloudDownload";
import DocumentExport from "@carbon/icons-react/es/DocumentExport";
import DocumentImport from "@carbon/icons-react/es/DocumentImport";
import Search from "@carbon/icons-react/es/Search";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
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
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { downloadText } from "@/lib/download";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { ArchiveRetention } from "../archive-retention";

type Entity = RouterInputs["workspace"]["exportData"]["entity"];

type DuplicateEntity = RouterInputs["workspace"]["findDuplicates"]["entity"];

type InactiveDays = RouterInputs["workspace"]["archiveInactiveRecords"]["days"];

type ImportResult = RouterOutputs["workspace"]["importData"];

const ENTITY_LABEL = {
	CONTACT: "Leads",
	COMPANY: "Companies",
	DEAL: "Deals",
} as const satisfies Record<Entity, string>;

const ENTITIES = Object.keys(ENTITY_LABEL) as Entity[];

const DUPLICATE_PATH = {
	CONTACT: "/contacts",
	COMPANY: "/companies",
} as const satisfies Record<DuplicateEntity, string>;

const INACTIVE_OPTIONS: { days: InactiveDays; label: string }[] = [
	{ days: 30, label: "30 days" },
	{ days: 60, label: "60 days" },
	{ days: 90, label: "90 days" },
	{ days: 365, label: "1 year" },
];

const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;

function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${SIZE_UNITS[unit]}`;
}

function EntitySelect({
	id,
	value,
	onChange,
}: {
	id: string;
	value: Entity;
	onChange: (value: Entity) => void;
}) {
	return (
		<Select value={value} onValueChange={(next) => onChange(next as Entity)}>
			<SelectTrigger id={id}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{ENTITIES.map((entity) => (
					<SelectItem key={entity} value={entity}>
						{ENTITY_LABEL[entity]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle>{value}</CardTitle>
			</CardHeader>
		</Card>
	);
}

export function DataManagementView() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();

	const importTypeId = useId();
	const importFileId = useId();
	const exportTypeId = useId();
	const backupNameId = useId();
	const inactiveId = useId();

	const [importEntity, setImportEntity] = useState<Entity>("CONTACT");
	const [importFile, setImportFile] = useState<File | null>(null);
	const [importResult, setImportResult] = useState<ImportResult | null>(null);
	const [exportEntity, setExportEntity] = useState<Entity>("CONTACT");
	const [backupOpen, setBackupOpen] = useState(false);
	const [backupName, setBackupName] = useState("");
	const [inactiveDays, setInactiveDays] = useState<InactiveDays>(90);
	const [duplicateEntity, setDuplicateEntity] =
		useState<DuplicateEntity | null>(null);

	const overview = useQuery(trpc.workspace.dataManagement.queryOptions());
	const duplicates = useQuery({
		...trpc.workspace.findDuplicates.queryOptions({
			entity: duplicateEntity ?? "CONTACT",
		}),
		enabled: duplicateEntity !== null,
	});

	const importData = useMutation(
		trpc.workspace.importData.mutationOptions({
			onSuccess: async (result) => {
				await cache.dataManagement();
				setImportResult(result);
				setImportFile(null);
				toast.success(
					`Imported ${result.created} new and ${result.updated} updated. ${result.failed} rows failed.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const exportData = useMutation(
		trpc.workspace.exportData.mutationOptions({
			onSuccess: async (result) => {
				downloadText(result.filename, result.csv);
				await cache.dataManagement();
				toast.success(`Exported ${result.rowCount} rows.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const downloadTemplate = useMutation({
		mutationFn: (entity: Entity) =>
			queryClient.fetchQuery(
				trpc.workspace.importTemplate.queryOptions({ entity }),
			),
		onSuccess: (result) => downloadText(result.filename, result.csv),
		onError: (error) => toast.error(error.message),
	});

	const createBackup = useMutation(
		trpc.workspace.createBackup.mutationOptions({
			onSuccess: async (backup) => {
				await cache.dataManagement();
				setBackupOpen(false);
				setBackupName("");
				toast.success(`Backup saved with ${backup.recordCount} records.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const downloadBackup = useMutation(
		trpc.workspace.downloadBackup.mutationOptions({
			onSuccess: (file) =>
				downloadText(file.filename, file.content, "application/json"),
			onError: (error) => toast.error(error.message),
		}),
	);

	const deleteBackup = useMutation(
		trpc.workspace.deleteBackup.mutationOptions({
			onSuccess: async () => {
				await cache.dataManagement();
				toast.success("Backup deleted.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const clearArchived = useMutation(
		trpc.workspace.clearDeletedData.mutationOptions({
			onSuccess: async (result) => {
				await cache.dataManagement();
				toast.success(
					`Deleted ${result.purged} archived records for good. ${result.skipped + result.failed} were left in place.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const archiveInactive = useMutation(
		trpc.workspace.archiveInactiveRecords.mutationOptions({
			onSuccess: async (result) => {
				await cache.dataManagement();
				toast.success(
					`Archived ${result.contacts} leads and ${result.deals} deals.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!overview.data) {
		return (
			<div className="flex min-h-64 items-center justify-center">
				<Spinner />
			</div>
		);
	}

	const data = overview.data;

	return (
		<div className="flex flex-col gap-6 pb-16">
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Stat
					label="Active records"
					value={data.summary.totalRecords.toLocaleString()}
				/>
				<Stat
					label="Imports, last 30 days"
					value={data.summary.importsLast30Days}
				/>
				<Stat
					label="Exports, last 30 days"
					value={data.summary.exportsLast30Days}
				/>
				<Stat
					label="Last backup"
					value={
						data.summary.lastBackupAt ? (
							<LocalRelativeTime date={data.summary.lastBackupAt} />
						) : (
							"Never"
						)
					}
				/>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Import</CardTitle>
						<CardDescription>
							Add or update records from a CSV file. Rows that match an existing
							record by email, domain or name update it.
						</CardDescription>
						<CardAction>
							<Button
								variant="outline"
								disabled={downloadTemplate.isPending}
								onClick={() => downloadTemplate.mutate(importEntity)}
							>
								Template
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Field>
							<FieldLabel htmlFor={importTypeId}>Record type</FieldLabel>
							<EntitySelect
								id={importTypeId}
								value={importEntity}
								onChange={(entity) => {
									setImportEntity(entity);
									setImportResult(null);
								}}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={importFileId}>CSV file</FieldLabel>
							<Input
								id={importFileId}
								type="file"
								accept=".csv,text/csv"
								onChange={(event) => {
									setImportFile(event.target.files?.[0] ?? null);
									setImportResult(null);
								}}
							/>
						</Field>
						<Button
							disabled={!importFile || importData.isPending}
							onClick={async () => {
								if (!importFile) return;
								importData.mutate({
									entity: importEntity,
									csv: await importFile.text(),
									filename: importFile.name,
								});
							}}
						>
							{importData.isPending ? (
								<Spinner data-icon="inline-start" />
							) : (
								<Icon icon={DocumentImport} data-icon="inline-start" />
							)}
							Import
						</Button>
						{importResult && importResult.errors.length > 0 ? (
							<ul className="flex flex-col gap-1 text-destructive text-sm">
								{importResult.errors.slice(0, 10).map((error) => (
									<li key={`${error.line}-${error.message}`}>
										Line {error.line}: {error.message}
									</li>
								))}
							</ul>
						) : null}
						{data.recentImports.length > 0 ? (
							<ul className="flex flex-col divide-y text-sm">
								{data.recentImports.map((entry) => (
									<li
										key={entry.id}
										className="flex items-center justify-between gap-4 py-2"
									>
										<span className="truncate">
											{entry.filename ?? ENTITY_LABEL[entry.entity]}
										</span>
										<span className="shrink-0 text-muted-foreground">
											{entry.rowCount} rows
											{entry.failedCount > 0
												? `, ${entry.failedCount} failed`
												: ""}{" "}
											· <LocalRelativeTime date={entry.createdAt} />
										</span>
									</li>
								))}
							</ul>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Export</CardTitle>
						<CardDescription>
							Download every active record of one type as CSV.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Field>
							<FieldLabel htmlFor={exportTypeId}>Record type</FieldLabel>
							<EntitySelect
								id={exportTypeId}
								value={exportEntity}
								onChange={setExportEntity}
							/>
						</Field>
						<Button
							disabled={exportData.isPending}
							onClick={() => exportData.mutate({ entity: exportEntity })}
						>
							{exportData.isPending ? (
								<Spinner data-icon="inline-start" />
							) : (
								<Icon icon={DocumentExport} data-icon="inline-start" />
							)}
							Export
						</Button>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Backups</CardTitle>
					<CardDescription>
						A backup is a full copy of leads, companies, deals and activities,
						kept in this database. Download it to keep a copy somewhere else.
					</CardDescription>
					{data.canManage ? (
						<CardAction>
							<Button variant="outline" onClick={() => setBackupOpen(true)}>
								<Icon icon={Add} data-icon="inline-start" />
								Create backup
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent>
					{data.backups.length === 0 ? (
						<p className="text-muted-foreground text-sm">No backups yet.</p>
					) : (
						<ul className="flex flex-col divide-y text-sm">
							{data.backups.map((backup) => (
								<li
									key={backup.id}
									className="flex items-center justify-between gap-4 py-2"
								>
									<span className="flex min-w-0 flex-col">
										<span className="truncate font-medium">{backup.name}</span>
										<span className="text-muted-foreground">
											<LocalRelativeTime date={backup.createdAt} /> ·{" "}
											{backup.recordCount.toLocaleString()} records ·{" "}
											{formatBytes(backup.sizeBytes)}
										</span>
									</span>
									{data.canManage ? (
										<span className="flex shrink-0 items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												disabled={downloadBackup.isPending}
												onClick={() => downloadBackup.mutate({ id: backup.id })}
											>
												<Icon icon={CloudDownload} data-icon="inline-start" />
												Download
											</Button>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														disabled={deleteBackup.isPending}
													>
														<Icon icon={TrashCan} />
														<span className="sr-only">
															Delete {backup.name}
														</span>
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															Delete this backup?
														</AlertDialogTitle>
														<AlertDialogDescription>
															“{backup.name}” is removed for good. Your records
															are not touched.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															variant="destructive"
															onClick={() =>
																deleteBackup.mutate({ id: backup.id })
															}
														>
															Delete backup
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</span>
									) : null}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<ArchiveRetention />

				<Card>
					<CardHeader>
						<CardTitle>Clean up</CardTitle>
						<CardDescription>
							{data.canManage
								? "Archive records nobody has touched, or delete archived records now instead of waiting."
								: "Only an owner or an admin can clean up records."}
						</CardDescription>
					</CardHeader>
					{data.canManage ? (
						<CardContent className="flex flex-col gap-4">
							<Field>
								<FieldLabel htmlFor={inactiveId}>
									Archive leads and deals with no activity for
								</FieldLabel>
								<div className="flex items-center gap-2">
									<Select
										value={String(inactiveDays)}
										onValueChange={(value) =>
											setInactiveDays(Number(value) as InactiveDays)
										}
									>
										<SelectTrigger id={inactiveId}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{INACTIVE_OPTIONS.map((option) => (
												<SelectItem
													key={option.days}
													value={String(option.days)}
												>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="outline"
												disabled={archiveInactive.isPending}
											>
												Archive
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Archive inactive records?
												</AlertDialogTitle>
												<AlertDialogDescription>
													Leads and deals with no activity in the chosen period
													move to the Archived view. You can restore them from
													there.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() =>
														archiveInactive.mutate({ days: inactiveDays })
													}
												>
													Archive
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</Field>

							<Field>
								<FieldLabel>Archived records</FieldLabel>
								<FieldDescription>
									Archived records are deleted for good after the retention
									period. Do it now to free them immediately.
								</FieldDescription>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="destructive"
											disabled={clearArchived.isPending}
										>
											{clearArchived.isPending ? (
												<Spinner data-icon="inline-start" />
											) : null}
											Delete archived records now
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Delete every archived record?
											</AlertDialogTitle>
											<AlertDialogDescription>
												Every archived lead, company and deal is deleted for
												good. This cannot be undone.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												variant="destructive"
												onClick={() => clearArchived.mutate({ entity: null })}
											>
												Delete for good
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</Field>
						</CardContent>
					) : null}
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Duplicates</CardTitle>
					<CardDescription>
						Find active leads or companies that share the same name. Open a
						record to merge or archive it by hand.
					</CardDescription>
					<CardAction className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => setDuplicateEntity("CONTACT")}
						>
							<Icon icon={Search} data-icon="inline-start" />
							Leads
						</Button>
						<Button
							variant="outline"
							onClick={() => setDuplicateEntity("COMPANY")}
						>
							<Icon icon={Search} data-icon="inline-start" />
							Companies
						</Button>
					</CardAction>
				</CardHeader>
				{duplicateEntity ? (
					<CardContent>
						{duplicates.isFetching ? (
							<Spinner />
						) : duplicates.error ? (
							<p className="text-destructive text-sm">
								{duplicates.error.message}
							</p>
						) : (duplicates.data?.groups.length ?? 0) === 0 ? (
							<p className="text-muted-foreground text-sm">
								No duplicate{" "}
								{duplicateEntity === "CONTACT" ? "leads" : "companies"}.
							</p>
						) : (
							<ul className="flex flex-col divide-y text-sm">
								{duplicates.data?.groups.map((group) => (
									<li key={group.key} className="flex flex-col gap-1 py-2">
										<span className="font-medium">
											{group.records[0]?.name} · {group.records.length} records
										</span>
										<span className="flex flex-wrap gap-3">
											{group.records.map((record, index) => (
												<Link
													key={record.id}
													className="text-primary underline-offset-4 hover:underline"
													href={workspaceUrl(
														`${DUPLICATE_PATH[duplicateEntity]}/${record.id}`,
													)}
												>
													Record {index + 1}
												</Link>
											))}
										</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				) : null}
			</Card>

			<Dialog open={backupOpen} onOpenChange={setBackupOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create backup</DialogTitle>
						<DialogDescription>
							Saves a copy of every lead, company, deal and activity.
						</DialogDescription>
					</DialogHeader>
					<form
						id="create-backup"
						onSubmit={(event) => {
							event.preventDefault();
							const name = backupName.trim();
							if (name) createBackup.mutate({ name });
						}}
					>
						<Field>
							<FieldLabel htmlFor={backupNameId}>Backup name</FieldLabel>
							<Input
								id={backupNameId}
								value={backupName}
								onChange={(event) => setBackupName(event.target.value)}
								placeholder="e.g. Before the October import"
							/>
						</Field>
					</form>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							type="submit"
							form="create-backup"
							disabled={!backupName.trim() || createBackup.isPending}
						>
							{createBackup.isPending ? (
								<Spinner data-icon="inline-start" />
							) : null}
							Create backup
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
