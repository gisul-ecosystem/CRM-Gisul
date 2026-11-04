"use client";

import Add from "@carbon/icons-react/es/Add";
import DocumentImport from "@carbon/icons-react/es/DocumentImport";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Card } from "@crm/ui/components/card";
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
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
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
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { OutreachStatus } from "@/components/outreach/status";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { IMPORT_LIMITS } from "@/lib/outreach/contact-fields";
import { COUNT, DATE_ONLY } from "@/lib/outreach/format";
import { SUPPRESSION_REASON } from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type {
	Suppression,
	SuppressionImportReport,
} from "@/lib/outreach/schemas/audience";
import {
	SUPPRESSION_REASONS,
	type SuppressionReason,
} from "@/lib/outreach/schemas/enums";
import { useDebounced } from "@/lib/outreach/use-debounced";

const REASON_HELP = {
	manual: "Added by your team",
	unsubscribed: "Asked to stop",
	bounced: "The address does not exist",
	complaint: "Marked an email as spam",
} as const satisfies Record<SuppressionReason, string>;

type ReasonFilter = SuppressionReason | typeof ALL;

const REASON_OPTIONS: { value: ReasonFilter; label: string }[] = [
	{ value: ALL, label: "All reasons" },
	...SUPPRESSION_REASONS.map((reason) => ({
		value: reason,
		label: SUPPRESSION_REASON[reason].label,
	})),
];

export function SuppressionsTab() {
	const cache = useOutreachCache();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [reason, setReason] = useState<ReasonFilter>(ALL);
	const [addOpen, setAddOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [toDelete, setToDelete] = useState<Suppression | null>(null);
	const query = useDebounced(search.trim());

	const suppressions = useQuery({
		queryKey: [...outreachKeys.suppressions, "list", { page, query, reason }],
		queryFn: () =>
			audienceApi.suppressions({
				page,
				limit: OUTREACH.pageSize,
				search: query || undefined,
				reason: reason === ALL ? undefined : reason,
			}),
		placeholderData: (previous) => previous,
	});

	const remove = useMutation({
		mutationFn: (id: string) => audienceApi.removeSuppression(id),
		onSuccess: async () => {
			await cache.audience();
			setToDelete(null);
			toast.success("Removed from the suppression list.");
		},
		onError: (error) => toast.error(error.message),
	});

	const rows = suppressions.data?.data ?? [];
	const total = suppressions.data?.total ?? 0;
	const filtering = Boolean(query) || reason !== ALL;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<OutreachToolbar>
					<SearchBox
						value={search}
						onChange={(value) => {
							setSearch(value);
							setPage(1);
						}}
						placeholder="Search email"
					/>
					<FilterSelect
						value={reason}
						onChange={(value) => {
							setReason(value);
							setPage(1);
						}}
						options={REASON_OPTIONS}
						label="Filter by reason"
					/>
				</OutreachToolbar>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => setImportOpen(true)}>
						<Icon icon={DocumentImport} data-icon="inline-start" />
						Import CSV
					</Button>
					<Button onClick={() => setAddOpen(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						Add email
					</Button>
				</div>
			</div>

			<p className="text-muted-foreground text-xs">
				Nobody on this list is ever emailed by a campaign. Bounces and replies
				like “no” or “unsubscribe” are added automatically.
			</p>

			{suppressions.isPending ? (
				<Skeleton className="h-40 w-full rounded-lg" />
			) : suppressions.isError ? (
				<p className="text-destructive text-xs">{suppressions.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{filtering ? "No match" : "Nobody is suppressed yet"}
						</EmptyTitle>
						<EmptyDescription>
							{filtering
								? "Change the search or the reason filter."
								: "Add an address by hand or import a CSV file."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "email", header: "Email" },
						{ id: "reason", header: "Reason" },
						{ id: "note", header: "Note" },
						{ id: "added", header: "Added" },
						{ id: "actions", srLabel: "Remove", width: "w-12" },
					]}
				>
					{rows.map((entry) => (
						<SimpleTableRow key={entry.id}>
							<TableCell className="px-3 font-medium">{entry.email}</TableCell>
							<TableCell className="px-3">
								<OutreachStatus status={SUPPRESSION_REASON[entry.reason]} />
							</TableCell>
							<TableCell className="max-w-64 truncate px-3 text-muted-foreground text-xs">
								{entry.note || "—"}
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								<LocalDateTime date={entry.createdAt} options={DATE_ONLY} />
							</TableCell>
							<TableCell className="px-3">
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Remove ${entry.email}`}
									onClick={() => setToDelete(entry)}
								>
									<Icon icon={TrashCan} />
								</Button>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			{total > OUTREACH.pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(total / OUTREACH.pageSize)}
					pageSize={OUTREACH.pageSize}
					total={total}
					onPageChange={setPage}
					loading={suppressions.isFetching}
				/>
			) : null}

			<AddSuppressionDialog open={addOpen} onOpenChange={setAddOpen} />
			<ImportSuppressionsDialog
				open={importOpen}
				onOpenChange={setImportOpen}
			/>
			<ConfirmDialog
				open={toDelete !== null}
				title={`Remove ${toDelete?.email ?? ""} from the suppression list?`}
				description="Campaigns can email this address again. Do this only when the person asked to hear from you."
				action="Remove"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}

function ReasonSelect({
	value,
	onChange,
}: {
	value: SuppressionReason;
	onChange: (value: SuppressionReason) => void;
}) {
	return (
		<Select
			value={value}
			onValueChange={(next) => {
				const match = SUPPRESSION_REASONS.find((reason) => reason === next);
				if (match) onChange(match);
			}}
		>
			<SelectTrigger>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{SUPPRESSION_REASONS.map((reason) => (
					<SelectItem key={reason} value={reason}>
						{SUPPRESSION_REASON[reason].label} — {REASON_HELP[reason]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function AddSuppressionDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const emailId = useId();
	const noteId = useId();
	const cache = useOutreachCache();
	const [email, setEmail] = useState("");
	const [reason, setReason] = useState<SuppressionReason>("manual");
	const [note, setNote] = useState("");

	const create = useMutation({
		mutationFn: () =>
			audienceApi.createSuppression({
				email: email.trim(),
				reason,
				note: note.trim(),
			}),
		onSuccess: async (saved) => {
			await cache.audience();
			toast.success(`${saved.email} will never be emailed.`);
			setEmail("");
			setNote("");
			setReason("manual");
			onOpenChange(false);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add to the suppression list</DialogTitle>
					<DialogDescription>
						This address is never emailed again.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={emailId}>Email</FieldLabel>
						<Input
							id={emailId}
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel>Reason</FieldLabel>
						<ReasonSelect value={reason} onChange={setReason} />
					</Field>
					<Field>
						<FieldLabel htmlFor={noteId}>Note (optional)</FieldLabel>
						<Input
							id={noteId}
							value={note}
							placeholder="e.g. replied “not interested”"
							onChange={(event) => setNote(event.target.value)}
						/>
					</Field>
				</FieldGroup>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						disabled={create.isPending || !email.trim()}
						onClick={() => create.mutate()}
					>
						{create.isPending ? "Adding…" : "Add"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ImportSuppressionsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const fileId = useId();
	const cache = useOutreachCache();
	const [file, setFile] = useState<File | null>(null);
	const [reason, setReason] = useState<SuppressionReason>("manual");
	const [report, setReport] = useState<SuppressionImportReport | null>(null);

	const run = useMutation({
		mutationFn: () => {
			if (!file) throw new Error("Choose a CSV file first.");
			return audienceApi.importSuppressions({ file, reason });
		},
		onSuccess: async (result) => {
			await cache.audience();
			setReport(result);
		},
		onError: (error) => toast.error(error.message),
	});

	const close = (next: boolean) => {
		onOpenChange(next);
		if (!next) {
			setFile(null);
			setReport(null);
			setReason("manual");
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Import a suppression list</DialogTitle>
					<DialogDescription>
						A CSV file with a column named “email”.
					</DialogDescription>
				</DialogHeader>
				{report ? (
					<>
						<Card>
							<div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3">
								<StatCard label="Rows" value={COUNT.format(report.total)} />
								<StatCard label="Added" value={COUNT.format(report.added)} />
								<StatCard
									label="Already on the list"
									value={COUNT.format(report.alreadySuppressed)}
								/>
								<StatCard
									label="Duplicates in file"
									value={COUNT.format(report.duplicatesInFile)}
								/>
								<StatCard
									label="Invalid"
									value={COUNT.format(report.invalid)}
								/>
								<StatCard
									label="Contacts updated"
									value={COUNT.format(report.contactsUpdated)}
								/>
							</div>
						</Card>
						<DialogFooter>
							<Button onClick={() => close(false)}>Done</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor={fileId}>CSV file</FieldLabel>
								<Input
									id={fileId}
									type="file"
									accept=".csv,text/csv"
									onChange={(event) => setFile(event.target.files?.[0] ?? null)}
								/>
								<FieldDescription>
									At most {IMPORT_LIMITS.maxLabel}.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>Reason for every address in the file</FieldLabel>
								<ReasonSelect value={reason} onChange={setReason} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button variant="outline" onClick={() => close(false)}>
								Cancel
							</Button>
							<Button
								disabled={!file || run.isPending}
								onClick={() => run.mutate()}
							>
								{run.isPending ? "Importing…" : "Import"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
