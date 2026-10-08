"use client";

import Add from "@carbon/icons-react/es/Add";
import Archive from "@carbon/icons-react/es/Archive";
import CloudDownload from "@carbon/icons-react/es/CloudDownload";
import CloudUpload from "@carbon/icons-react/es/CloudUpload";
import DocumentExport from "@carbon/icons-react/es/DocumentExport";
import DocumentImport from "@carbon/icons-react/es/DocumentImport";
import Information from "@carbon/icons-react/es/Information";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Search from "@carbon/icons-react/es/Search";
import Time from "@carbon/icons-react/es/Time";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
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
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type DataManagementData = RouterOutputs["workspace"]["dataManagement"];
type BackupItem = DataManagementData["backups"][number];

const DATA_TYPES = ["Leads", "Customers", "Deals", "Activities", "All Data"];
const RETENTION_OPTIONS = [
	"Keep for 30 days",
	"Keep for 60 days",
	"Keep for 90 days",
	"Keep for 180 days",
	"Keep for 1 year",
	"Keep for 2 years",
	"Keep forever",
];

export function DataManagementView() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		trpc.workspace.dataManagement.queryOptions(),
	);

	// Import form state
	const [importDataType, setImportDataType] = useState("Leads");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	// Export form state
	const [exportDataType, setExportDataType] = useState("Customers");
	const [exportDateRange, setExportDateRange] = useState("Last 30 days");
	const [exportFilter, setExportFilter] = useState("All");
	const [includeFields, setIncludeFields] = useState<"all" | "custom">("all");

	// Modals
	const [isCreateBackupOpen, setIsCreateBackupOpen] = useState(false);
	const [newBackupName, setNewBackupName] = useState("");

	const [isClearTrashOpen, setIsClearTrashOpen] = useState(false);
	const [isArchiveOpen, setIsArchiveOpen] = useState(false);
	const [isFindDuplicatesOpen, setIsFindDuplicatesOpen] = useState(false);

	const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [understandIrreversible, setUnderstandIrreversible] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	// --- Mutations ---
	const createBackupMutation = useMutation(
		trpc.workspace.createBackup.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success("Backup created successfully");
				setIsCreateBackupOpen(false);
				setNewBackupName("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteBackupMutation = useMutation(
		trpc.workspace.deleteBackup.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success("Backup removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateRetentionMutation = useMutation(
		trpc.workspace.updateDataRetention.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success("Retention policy updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const clearTrashMutation = useMutation(
		trpc.workspace.clearDeletedData.mutationOptions({
			onSuccess: (res) => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success(`Cleared ${res.clearedCount} deleted records from trash`);
				setIsClearTrashOpen(false);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const archiveRecordsMutation = useMutation(
		trpc.workspace.archiveInactiveRecords.mutationOptions({
			onSuccess: (res) => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success(`Archived ${res.archivedCount} inactive records`);
				setIsArchiveOpen(false);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const exportMutation = useMutation(
		trpc.workspace.exportData.mutationOptions({
			onSuccess: (res) => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success(`Export ready! ${res.rowCount} records prepared for download`);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const importMutation = useMutation(
		trpc.workspace.importData.mutationOptions({
			onSuccess: (res) => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.dataManagement.queryKey(),
				});
				toast.success(`Successfully imported ${res.importedCount} records`);
				setSelectedFile(null);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteAccountMutation = useMutation(
		trpc.workspace.deleteAccount.mutationOptions({
			onSuccess: () => {
				toast.success("Account deletion request submitted");
				setIsDeleteAccountOpen(false);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	if (isLoading || !data) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<Spinner className="h-6 w-6 text-muted-foreground" />
			</div>
		);
	}

	const handleDownloadTemplate = () => {
		const csvContent =
			"data:text/csv;charset=utf-8,First Name,Last Name,Email,Phone,Company,Job Title,Notes\nJane,Doe,jane@example.com,+1234567890,Acme Inc,Sales Director,VIP Client";
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", `${importDataType.toLowerCase()}_template.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		toast.success(`Template downloaded for ${importDataType}`);
	};

	return (
		<div className="flex flex-col gap-6 pb-16">
			{/* SECTION 1: 4 Metric Cards */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{/* 1. Total Records */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
						<Icon icon={Archive} className="h-5 w-5" />
					</div>
					<div>
						<p className="text-xl font-bold tracking-tight text-foreground">
							{data.summary.totalRecords.toLocaleString()}
						</p>
						<p className="text-xs font-semibold text-foreground/80 mt-0.5">
							Total Records
						</p>
						<p className="text-[11px] text-muted-foreground">
							Leads, customers, deals & activities
						</p>
					</div>
				</div>

				{/* 2. Imports */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
						<Icon icon={DocumentImport} className="h-5 w-5" />
					</div>
					<div>
						<p className="text-xl font-bold tracking-tight text-foreground">
							{data.summary.importsCount}
						</p>
						<p className="text-xs font-semibold text-foreground/80 mt-0.5">
							Imports
						</p>
						<p className="text-[11px] text-muted-foreground">Last 30 days</p>
					</div>
				</div>

				{/* 3. Exports */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
						<Icon icon={DocumentExport} className="h-5 w-5" />
					</div>
					<div>
						<p className="text-xl font-bold tracking-tight text-foreground">
							{data.summary.exportsCount}
						</p>
						<p className="text-xs font-semibold text-foreground/80 mt-0.5">
							Exports
						</p>
						<p className="text-[11px] text-muted-foreground">Last 30 days</p>
					</div>
				</div>

				{/* 4. Last Backup */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
						<Icon icon={Time} className="h-5 w-5" />
					</div>
					<div>
						<p className="text-xs font-semibold text-foreground/80">
							Last Backup
						</p>
						<p className="text-xs font-medium text-muted-foreground mt-0.5">
							{data.summary.lastBackupDate}
						</p>
						<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
							{data.summary.lastBackupStatus}
						</span>
					</div>
				</div>
			</div>

			{/* SECTION 2: Import Data & Export Data */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* 2A: Import Data Card */}
				<div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
					<div>
						<div className="flex items-start justify-between gap-3">
							<div>
								<h3 className="text-base font-bold text-foreground">
									Import Data
								</h3>
								<p className="text-xs text-muted-foreground mt-1">
									Import your leads, customers, deals or activities from a
									CSV file.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleDownloadTemplate}
								className="shrink-0 text-xs rounded-xl border-border/70 text-foreground hover:bg-muted"
							>
								Download Template
							</Button>
						</div>

						<div className="mt-5 space-y-4">
							<div>
								<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
									Select Data Type
								</FieldLabel>
								<Select
									value={importDataType}
									onValueChange={setImportDataType}
								>
									<SelectTrigger className="h-10 text-xs rounded-xl border-border/60 bg-background/70">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{DATA_TYPES.map((dt) => (
											<SelectItem key={dt} value={dt} className="text-xs">
												{dt}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Dropzone */}
							<label
								htmlFor="csv-file-upload"
								className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40"
							>
								<input
									id="csv-file-upload"
									type="file"
									accept=".csv"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) {
											setSelectedFile(file);
											toast.success(`Selected file: ${file.name}`);
										}
									}}
								/>
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
									<Icon icon={CloudUpload} className="h-5 w-5" />
								</div>
								<p className="text-xs font-semibold text-foreground">
									{selectedFile
										? selectedFile.name
										: "Drag and drop your CSV file here"}
								</p>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									or click to browse
								</p>
							</label>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
						<p className="text-[11px] text-muted-foreground">
							Supported format: CSV (max 10MB)
						</p>
						<Button
							disabled={!selectedFile || importMutation.isPending}
							onClick={() => {
								if (selectedFile) {
									importMutation.mutate({
										dataType: importDataType,
										filename: selectedFile.name,
									});
								}
							}}
							className="gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
						>
							<Icon icon={DocumentImport} className="h-3.5 w-3.5" />
							{importMutation.isPending ? "Importing..." : "Import Data"}
						</Button>
					</div>
				</div>

				{/* 2B: EXPORT DATA Card */}
				<div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
					<div>
						<h3 className="text-base font-bold tracking-tight text-foreground uppercase">
							EXPORT DATA
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Export your CRM data in CSV format.
						</p>

						<div className="mt-5 space-y-4">
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<div>
									<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
										Select Data Type
									</FieldLabel>
									<Select
										value={exportDataType}
										onValueChange={setExportDataType}
									>
										<SelectTrigger className="h-9 text-xs rounded-xl border-border/60 bg-background/70">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DATA_TYPES.map((dt) => (
												<SelectItem key={dt} value={dt} className="text-xs">
													{dt}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div>
									<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
										Date Range
									</FieldLabel>
									<Select
										value={exportDateRange}
										onValueChange={setExportDateRange}
									>
										<SelectTrigger className="h-9 text-xs rounded-xl border-border/60 bg-background/70">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{["Last 30 days", "Last 90 days", "This Year", "All Time"].map(
												(dr) => (
													<SelectItem key={dr} value={dr} className="text-xs">
														{dr}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
								</div>

								<div>
									<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
										Filter (Optional)
									</FieldLabel>
									<Input
										value={exportFilter}
										onChange={(e) => setExportFilter(e.target.value)}
										placeholder="All"
										className="h-9 text-xs rounded-xl border-border/60 bg-background/70"
									/>
								</div>
							</div>

							<div>
								<FieldLabel className="text-xs font-semibold text-muted-foreground mb-2 block">
									Include Fields
								</FieldLabel>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<label
										onClick={() => setIncludeFields("all")}
										className={cn(
											"flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors",
											includeFields === "all"
												? "border-primary bg-primary/5 text-foreground"
												: "border-border/60 bg-background/50 hover:bg-muted/30 text-muted-foreground",
										)}
									>
										<input
											type="radio"
											name="includeFields"
											checked={includeFields === "all"}
											onChange={() => setIncludeFields("all")}
											className="mt-0.5 text-primary accent-primary"
										/>
										<div>
											<p className="text-xs font-bold text-foreground">
												All Fields
											</p>
											<p className="text-[11px] text-muted-foreground mt-0.5">
												Export all available fields
											</p>
										</div>
									</label>

									<label
										onClick={() => setIncludeFields("custom")}
										className={cn(
											"flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors",
											includeFields === "custom"
												? "border-primary bg-primary/5 text-foreground"
												: "border-border/60 bg-background/50 hover:bg-muted/30 text-muted-foreground",
										)}
									>
										<input
											type="radio"
											name="includeFields"
											checked={includeFields === "custom"}
											onChange={() => setIncludeFields("custom")}
											className="mt-0.5 text-primary accent-primary"
										/>
										<div>
											<p className="text-xs font-bold text-foreground">
												Custom Fields
											</p>
											<p className="text-[11px] text-muted-foreground mt-0.5">
												Choose specific fields to export
											</p>
										</div>
									</label>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-end border-t border-border/40 pt-4">
						<Button
							disabled={exportMutation.isPending}
							onClick={() => {
								exportMutation.mutate({
									dataType: exportDataType,
									dateRange: exportDateRange,
									filter: exportFilter,
									includeFields,
								});
							}}
							className="gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
						>
							<Icon icon={DocumentExport} className="h-3.5 w-3.5" />
							{exportMutation.isPending ? "Exporting..." : "Export Data"}
						</Button>
					</div>
				</div>
			</div>

			{/* SECTION 3: Data Backup & Data Retention/Cleanup */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* 3A: Data Backup */}
				<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
						<div>
							<h3 className="text-base font-bold text-foreground">
								Data Backup
							</h3>
							<p className="text-xs text-muted-foreground mt-1">
								Create and manage backups of your CRM data.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsCreateBackupOpen(true)}
							className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl text-xs"
						>
							<Icon icon={Add} className="h-3.5 w-3.5" />
							Create Backup
						</Button>
					</div>

					<div className="mt-5 overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/40 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
									<th className="pb-3 pl-1 font-semibold w-8">#</th>
									<th className="pb-3 font-semibold min-w-[140px]">
										BACKUP NAME
									</th>
									<th className="pb-3 font-semibold min-w-[140px]">
										CREATED ON
									</th>
									<th className="pb-3 font-semibold w-20">SIZE</th>
									<th className="pb-3 font-semibold w-20 text-center">
										STATUS
									</th>
									<th className="pb-3 pr-2 font-semibold w-10 text-right">
										ACTIONS
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30 font-medium">
								{data.backups.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="py-8 text-center text-xs text-muted-foreground"
										>
											No backups created yet. Click &quot;Create Backup&quot; to
											generate your first snapshot.
										</td>
									</tr>
								) : (
									data.backups.map((b, index) => (
										<tr
											key={b.id}
											className="group hover:bg-muted/30 transition-colors"
										>
											<td className="py-3 pl-1 text-muted-foreground font-semibold">
												{index + 1}
											</td>
											<td className="py-3 font-semibold text-foreground">
												{b.name}
											</td>
											<td className="py-3 text-muted-foreground">
												{b.createdOn}
											</td>
										<td className="py-3 text-foreground/80">{b.size}</td>
										<td className="py-3 text-center">
											<span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
												{b.status}
											</span>
										</td>
										<td className="py-3 pr-2 text-right">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<button
														type="button"
														className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
													>
														<Icon
															icon={OverflowMenuVertical}
															className="h-4 w-4"
														/>
													</button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => {
															toast.success(`Downloading ${b.name}...`);
														}}
													>
														<Icon
															icon={CloudDownload}
															className="mr-2 h-3.5 w-3.5"
														/>
														Download
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => {
															if (confirm(`Delete backup "${b.name}"?`)) {
																deleteBackupMutation.mutate({ id: b.id });
															}
														}}
													>
														<Icon
															icon={TrashCan}
															className="mr-2 h-3.5 w-3.5"
														/>
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</td>
									</tr>
								)))}
							</tbody>
						</table>
					</div>
				</div>

				{/* 3B: Data Retention & Cleanup */}
				<div className="flex flex-col gap-6">
					{/* Data Retention */}
					<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
						<h3 className="text-base font-bold text-foreground">
							Data Retention
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Configure how long to keep deleted data.
						</p>

						<div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1 block">
									Deleted Leads
								</FieldLabel>
								<Select
									value={data.retention.deletedLeads}
									onValueChange={(val) => {
										updateRetentionMutation.mutate({ deletedLeads: val });
									}}
								>
									<SelectTrigger className="h-9 text-xs rounded-xl border-border/60 bg-background/70">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{RETENTION_OPTIONS.map((opt) => (
											<SelectItem key={opt} value={opt} className="text-xs">
												{opt}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1 block">
									Deleted Customers
								</FieldLabel>
								<Select
									value={data.retention.deletedCustomers}
									onValueChange={(val) => {
										updateRetentionMutation.mutate({
											deletedCustomers: val,
										});
									}}
								>
									<SelectTrigger className="h-9 text-xs rounded-xl border-border/60 bg-background/70">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{RETENTION_OPTIONS.map((opt) => (
											<SelectItem key={opt} value={opt} className="text-xs">
												{opt}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1 block">
									Deleted Activities
								</FieldLabel>
								<Select
									value={data.retention.deletedActivities}
									onValueChange={(val) => {
										updateRetentionMutation.mutate({
											deletedActivities: val,
										});
									}}
								>
									<SelectTrigger className="h-9 text-xs rounded-xl border-border/60 bg-background/70">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{RETENTION_OPTIONS.map((opt) => (
											<SelectItem key={opt} value={opt} className="text-xs">
												{opt}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1 block">
									Deleted Deals
								</FieldLabel>
								<Select
									value={data.retention.deletedDeals}
									onValueChange={(val) => {
										updateRetentionMutation.mutate({ deletedDeals: val });
									}}
								>
									<SelectTrigger className="h-9 text-xs rounded-xl border-border/60 bg-background/70">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{RETENTION_OPTIONS.map((opt) => (
											<SelectItem key={opt} value={opt} className="text-xs">
												{opt}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="mt-5 flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
							<Icon icon={Information} className="h-4 w-4 shrink-0" />
							<span>
								Deleted data is moved to trash and can be restored within
								the retention period.
							</span>
						</div>
					</div>

					{/* Data Cleanup */}
					<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
						<h3 className="text-base font-bold text-foreground">
							Data Cleanup
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Remove old or unwanted data to keep your CRM organized.
						</p>

						<div className="mt-4 space-y-2.5">
							<div
								onClick={() => setIsClearTrashOpen(true)}
								className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
										<Icon icon={TrashCan} className="h-4 w-4" />
									</div>
									<div>
										<p className="text-xs font-semibold text-foreground">
											Clear Deleted Data
										</p>
										<p className="text-[11px] text-muted-foreground">
											Permanently delete data from trash
										</p>
									</div>
								</div>
								<span className="text-muted-foreground text-sm font-semibold">
									&gt;
								</span>
							</div>

							<div
								onClick={() => setIsArchiveOpen(true)}
								className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
										<Icon icon={Archive} className="h-4 w-4" />
									</div>
									<div>
										<p className="text-xs font-semibold text-foreground">
											Archive Inactive Records
										</p>
										<p className="text-[11px] text-muted-foreground">
											Archive old or inactive leads, customers or deals
										</p>
									</div>
								</div>
								<span className="text-muted-foreground text-sm font-semibold">
									&gt;
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* SECTION 4: Merge Records */}
			<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
				<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 className="text-base font-bold text-foreground">
							Merge Records
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Find and merge duplicate leads or customers.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsFindDuplicatesOpen(true)}
						className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl text-xs"
					>
						<Icon icon={Search} className="h-3.5 w-3.5" />
						Find Duplicates
					</Button>
				</div>

				<div className="mt-5 space-y-2.5">
					<div
						onClick={() => {
							toast.info("Scanning for duplicate leads... 0 found.");
						}}
						className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3.5 hover:bg-muted/40 cursor-pointer transition-colors"
					>
						<div className="flex items-center gap-3">
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 text-xs font-bold">
								ML
							</div>
							<div>
								<p className="text-xs font-semibold text-foreground">
									Merge Duplicate Leads
								</p>
								<p className="text-[11px] text-muted-foreground">
									Identify and merge duplicate lead records
								</p>
							</div>
						</div>
						<span className="text-muted-foreground text-sm font-semibold">
							&gt;
						</span>
					</div>

					<div
						onClick={() => {
							toast.info("Scanning for duplicate customers... 0 found.");
						}}
						className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3.5 hover:bg-muted/40 cursor-pointer transition-colors"
					>
						<div className="flex items-center gap-3">
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-purple-600 text-xs font-bold">
								MC
							</div>
							<div>
								<p className="text-xs font-semibold text-foreground">
									Merge Duplicate Customers
								</p>
								<p className="text-[11px] text-muted-foreground">
									Identify and merge duplicate customer records
								</p>
							</div>
						</div>
						<span className="text-muted-foreground text-sm font-semibold">
							&gt;
						</span>
					</div>
				</div>
			</div>

			{/* SECTION 5: ACCOUNT SETTINGS */}
			<div className="rounded-2xl border border-rose-500/30 bg-card p-6 shadow-xs">
				<h3 className="text-base font-bold tracking-tight text-foreground uppercase">
					ACCOUNT SETTINGS
				</h3>
				<p className="text-xs text-muted-foreground mt-1">
					Manage your account and data.
				</p>

				<div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
						<div className="flex items-start gap-3">
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
								<Icon icon={WarningAlt} className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
									DELETE ACCOUNT
								</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									Permanently delete this CRM account and its associated
									workspace data. This action cannot be undone.
								</p>
							</div>
						</div>

						<Button
							variant="destructive"
							onClick={() => setIsDeleteAccountOpen(true)}
							className="shrink-0 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs px-4"
						>
							Delete Account
						</Button>
					</div>
				</div>
			</div>

			{/* Create Backup Modal */}
			<Dialog open={isCreateBackupOpen} onOpenChange={setIsCreateBackupOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Create Workspace Backup</DialogTitle>
						<DialogDescription>
							Save a snapshot of all contacts, companies, deals, and
							activities.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Backup Name</FieldLabel>
							<Input
								placeholder="e.g. Pre-Migration Snapshot"
								value={newBackupName}
								onChange={(e) => setNewBackupName(e.target.value)}
							/>
						</Field>
					</div>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							disabled={
								!newBackupName.trim() || createBackupMutation.isPending
							}
							onClick={() => {
								createBackupMutation.mutate({
									name: newBackupName.trim(),
								});
							}}
						>
							{createBackupMutation.isPending
								? "Creating..."
								: "Create Backup"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Clear Trash Confirmation Modal */}
			<Dialog open={isClearTrashOpen} onOpenChange={setIsClearTrashOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Clear Deleted Records</DialogTitle>
						<DialogDescription>
							Are you sure you want to permanently empty the trash? Records
							cannot be restored.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							variant="destructive"
							disabled={clearTrashMutation.isPending}
							onClick={() => clearTrashMutation.mutate({ type: "all" })}
						>
							{clearTrashMutation.isPending
								? "Clearing..."
								: "Permanently Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Archive Confirmation Modal */}
			<Dialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Archive Inactive Records</DialogTitle>
						<DialogDescription>
							Move leads and deals with no activity in the past 90 days to
							the archive.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							disabled={archiveRecordsMutation.isPending}
							onClick={() =>
								archiveRecordsMutation.mutate({ period: "90_days" })
							}
						>
							{archiveRecordsMutation.isPending
								? "Archiving..."
								: "Archive Records"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* DELETE ACCOUNT MODAL (Matching Screenshot 2) */}
			<Dialog
				open={isDeleteAccountOpen}
				onOpenChange={setIsDeleteAccountOpen}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle className="text-base font-bold tracking-tight text-foreground uppercase">
							DELETE ACCOUNT
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
								<Icon icon={WarningAlt} className="h-4 w-4" />
							</div>
							<div>
								<p className="text-xs font-bold text-foreground">
									Are you sure you want to delete your account?
								</p>
								<p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
									This will permanently delete your account and remove your
									access to Gisul CRM. Your data will be handled as per our
									data retention policy.
								</p>
							</div>
						</div>

						<label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
							<input
								type="checkbox"
								checked={understandIrreversible}
								onChange={(e) =>
									setUnderstandIrreversible(e.target.checked)
								}
								className="h-3.5 w-3.5 rounded border-border text-rose-600 focus:ring-rose-500 accent-rose-600"
							/>
							<span>I understand this action cannot be undone.</span>
						</label>

						<Field>
							<FieldLabel className="text-xs font-medium text-foreground">
								Enter your password to confirm
							</FieldLabel>
							<div className="relative">
								<Input
									type={showPassword ? "text" : "password"}
									placeholder="Enter your password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
									className="pr-10 text-xs rounded-xl"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
								>
									{showPassword ? "Hide" : "Show"}
								</button>
							</div>
						</Field>
					</div>

					<DialogFooter className="gap-2 sm:gap-0">
						<DialogClose asChild>
							<Button variant="outline" className="rounded-xl text-xs">
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant="destructive"
							disabled={
								!understandIrreversible ||
								!deletePassword.trim() ||
								deleteAccountMutation.isPending
							}
							onClick={() => {
								deleteAccountMutation.mutate({
									password: deletePassword.trim(),
									understandIrreversible,
								});
							}}
							className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs"
						>
							{deleteAccountMutation.isPending
								? "Deleting..."
								: "Delete Account"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
