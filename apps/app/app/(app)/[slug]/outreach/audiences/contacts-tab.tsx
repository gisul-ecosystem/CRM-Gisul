"use client";

import DocumentImport from "@carbon/icons-react/es/DocumentImport";
import Link from "@carbon/icons-react/es/Link";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { CopyLinkDialog } from "@/components/outreach/copy-link-dialog";
import { OutreachStatus } from "@/components/outreach/status";
import {
	ALL,
	FilterSelect,
	OutreachToolbar,
	SearchBox,
} from "@/components/outreach/toolbar";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { personName } from "@/lib/outreach/format";
import { CONTACT_STATUS } from "@/lib/outreach/labels";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { AudienceContact } from "@/lib/outreach/schemas/audience";
import {
	CONTACT_STATUSES,
	type ContactStatus,
} from "@/lib/outreach/schemas/enums";
import { useDebounced } from "@/lib/outreach/use-debounced";
import { ContactSheet } from "./contact-sheet";
import { EditContactDialog } from "./edit-contact-dialog";
import { ImportDialog } from "./import-dialog";

const LIST_PICKER_LIMIT = 100;

type StatusFilter = ContactStatus | typeof ALL;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: ALL, label: "All statuses" },
	...CONTACT_STATUSES.map((status) => ({
		value: status,
		label: CONTACT_STATUS[status].label,
	})),
];

export function ContactsTab() {
	const cache = useOutreachCache();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [listFilter, setListFilter] = useState<string>(ALL);
	const [status, setStatus] = useState<StatusFilter>(ALL);
	const [importOpen, setImportOpen] = useState(false);
	const [editing, setEditing] = useState<AudienceContact | null>(null);
	const [viewing, setViewing] = useState<AudienceContact | null>(null);
	const [linkFor, setLinkFor] = useState<AudienceContact | null>(null);
	const [toDelete, setToDelete] = useState<AudienceContact | null>(null);
	const query = useDebounced(search.trim());

	const lists = useQuery({
		queryKey: [...outreachKeys.lists, "picker"],
		queryFn: () => audienceApi.lists({ page: 1, limit: LIST_PICKER_LIMIT }),
	});
	const contacts = useQuery({
		queryKey: [
			...outreachKeys.contacts,
			"list",
			{ page, query, listFilter, status },
		],
		queryFn: () =>
			audienceApi.contacts({
				page,
				limit: OUTREACH.pageSize,
				search: query || undefined,
				listId: listFilter === ALL ? undefined : listFilter,
				status: status === ALL ? undefined : status,
			}),
		placeholderData: (previous) => previous,
	});

	const remove = useMutation({
		mutationFn: (id: string) => audienceApi.removeContact(id),
		onSuccess: async () => {
			await cache.audience();
			setToDelete(null);
			toast.success("Contact deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const listNames = new Map(
		(lists.data?.data ?? []).map((list) => [list.id, list.name]),
	);
	const listOptions = [
		{ value: ALL, label: "All lists" },
		...(lists.data?.data ?? []).map((list) => ({
			value: list.id,
			label: list.name,
		})),
	];
	const rows = contacts.data?.data ?? [];
	const total = contacts.data?.total ?? 0;
	const filtering = Boolean(query) || listFilter !== ALL || status !== ALL;

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
						placeholder="Search email, name, company"
					/>
					<FilterSelect
						value={listFilter}
						onChange={(value) => {
							setListFilter(value);
							setPage(1);
						}}
						options={listOptions}
						label="Filter by list"
					/>
					<FilterSelect
						value={status}
						onChange={(value) => {
							setStatus(value);
							setPage(1);
						}}
						options={STATUS_OPTIONS}
						label="Filter by status"
					/>
				</OutreachToolbar>
				<Button onClick={() => setImportOpen(true)}>
					<Icon icon={DocumentImport} data-icon="inline-start" />
					Import CSV
				</Button>
			</div>

			{contacts.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : contacts.isError ? (
				<p className="text-destructive text-xs">{contacts.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{filtering ? "No contacts match" : "No contacts yet"}
						</EmptyTitle>
						<EmptyDescription>
							{filtering
								? "Change the search or the filters."
								: "Import a CSV file to add the people your campaigns will email."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "email", header: "Email" },
						{ id: "name", header: "Name" },
						{ id: "company", header: "Company" },
						{ id: "lists", header: "Lists" },
						{ id: "status", header: "Status" },
						{ id: "activity", header: "Activity" },
						{ id: "actions", srLabel: "Actions", width: "w-20" },
					]}
				>
					{rows.map((contact) => (
						<SimpleTableRow key={contact.id}>
							<TableCell className="px-3 font-medium">
								<Button
									variant="link"
									className="h-auto p-0 text-foreground"
									onClick={() => setViewing(contact)}
								>
									{contact.email}
								</Button>
							</TableCell>
							<TableCell className="px-3">
								<p>
									{personName(contact) === contact.email
										? "—"
										: personName(contact)}
								</p>
								{contact.title ? (
									<p className="text-muted-foreground text-xs">
										{contact.title}
									</p>
								) : null}
							</TableCell>
							<TableCell className="px-3">{contact.company || "—"}</TableCell>
							<TableCell className="max-w-48 truncate px-3 text-muted-foreground text-xs">
								{contact.listIds
									.map((id) => listNames.get(id))
									.filter(Boolean)
									.join(", ") || "—"}
							</TableCell>
							<TableCell className="px-3">
								<OutreachStatus
									status={
										contact.suppressed
											? { label: "Suppressed", tone: "error" }
											: CONTACT_STATUS[contact.status]
									}
								/>
							</TableCell>
							<TableCell className="px-3">
								<ActivityBadges contact={contact} />
							</TableCell>
							<TableCell className="whitespace-nowrap px-3">
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Copy tracking link for ${contact.email}`}
									title="Copy tracking link"
									onClick={() => setLinkFor(contact)}
								>
									<Icon icon={Link} />
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Actions for ${contact.email}`}
										>
											<Icon icon={OverflowMenuHorizontal} />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => setViewing(contact)}>
											Activity
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => setLinkFor(contact)}>
											Copy link
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => setEditing(contact)}>
											Edit
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => setToDelete(contact)}
										>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
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
					loading={contacts.isFetching}
				/>
			) : null}

			<ImportDialog open={importOpen} onOpenChange={setImportOpen} />
			<ContactSheet contact={viewing} onClose={() => setViewing(null)} />
			<EditContactDialog contact={editing} onClose={() => setEditing(null)} />
			<CopyLinkDialog contact={linkFor} onClose={() => setLinkFor(null)} />
			<ConfirmDialog
				open={toDelete !== null}
				title={`Delete ${toDelete?.email ?? "this contact"}?`}
				description="The contact leaves every list. Emails already sent and their stats are kept."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}

function ActivityBadges({ contact }: { contact: AudienceContact }) {
	const engagement = contact.engagement;
	const maybeBots = engagement.clickCount - engagement.realClickCount;

	if (
		!engagement.emailsSent &&
		!engagement.replyCount &&
		!engagement.clickCount
	) {
		return <span className="text-muted-foreground">—</span>;
	}

	return (
		<div className="flex flex-wrap gap-1">
			{engagement.emailsSent > 0 ? (
				<Badge variant="outline">Emailed {engagement.emailsSent}×</Badge>
			) : null}
			{engagement.replyCount > 0 ? (
				<Badge variant="secondary">Replied</Badge>
			) : null}
			{engagement.realClickCount > 0 ? (
				<Badge variant="secondary">Clicked {engagement.realClickCount}×</Badge>
			) : maybeBots > 0 ? (
				<Badge
					variant="outline"
					title="The link was opened, but it looks like a security scanner, not a person."
				>
					Maybe a bot
				</Badge>
			) : null}
		</div>
	);
}
