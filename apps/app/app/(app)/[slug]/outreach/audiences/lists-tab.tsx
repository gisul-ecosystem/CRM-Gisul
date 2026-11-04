"use client";

import Add from "@carbon/icons-react/es/Add";
import Download from "@carbon/icons-react/es/Download";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
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
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { OutreachToolbar, SearchBox } from "@/components/outreach/toolbar";
import {
	destinationOf,
	LinkTargetFields,
	LocalLinksBanner,
	savedLinkTarget,
	useTrackingConfig,
} from "@/components/outreach/tracking-links";
import { audienceApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { downloadFromOutreach } from "@/lib/outreach/download";
import { COUNT, DATE_ONLY } from "@/lib/outreach/format";
import { OUTREACH } from "@/lib/outreach/outreach-config";
import type { AudienceList } from "@/lib/outreach/schemas/audience";
import { useDebounced } from "@/lib/outreach/use-debounced";

type Editing = { list: AudienceList | null } | null;

export function ListsTab() {
	const cache = useOutreachCache();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [editing, setEditing] = useState<Editing>(null);
	const [linksFor, setLinksFor] = useState<AudienceList | null>(null);
	const [toDelete, setToDelete] = useState<AudienceList | null>(null);
	const query = useDebounced(search.trim());

	const lists = useQuery({
		queryKey: [...outreachKeys.lists, "list", { page, query }],
		queryFn: () =>
			audienceApi.lists({
				page,
				limit: OUTREACH.pageSize,
				search: query || undefined,
			}),
		placeholderData: (previous) => previous,
	});

	const remove = useMutation({
		mutationFn: (id: string) => audienceApi.removeList(id),
		onSuccess: async () => {
			await cache.audience();
			setToDelete(null);
			toast.success("List deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const rows = lists.data?.data ?? [];
	const total = lists.data?.total ?? 0;

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
						placeholder="Search lists"
					/>
				</OutreachToolbar>
				<Button onClick={() => setEditing({ list: null })}>
					<Icon icon={Add} data-icon="inline-start" />
					New list
				</Button>
			</div>

			{lists.isPending ? (
				<Skeleton className="h-40 w-full rounded-lg" />
			) : lists.isError ? (
				<p className="text-destructive text-xs">{lists.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No lists yet</EmptyTitle>
						<EmptyDescription>
							Create a list here, or create one while importing a CSV.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "name", header: "Name" },
						{ id: "description", header: "Description" },
						{ id: "contacts", header: "Contacts", align: "right" },
						{ id: "created", header: "Created" },
						{ id: "actions", srLabel: "Actions", width: "w-12" },
					]}
				>
					{rows.map((list) => (
						<SimpleTableRow key={list.id}>
							<TableCell className="px-3 font-medium">{list.name}</TableCell>
							<TableCell className="max-w-72 truncate px-3 text-muted-foreground text-xs">
								{list.description || "—"}
							</TableCell>
							<TableCell className="px-3 text-right tabular-nums">
								{COUNT.format(list.contactCount)}
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								<LocalDateTime date={list.createdAt} options={DATE_ONLY} />
							</TableCell>
							<TableCell className="px-3">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Actions for ${list.name}`}
										>
											<Icon icon={OverflowMenuHorizontal} />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => setEditing({ list })}>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => setLinksFor(list)}>
											Download links (CSV)
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => setToDelete(list)}
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
					loading={lists.isFetching}
				/>
			) : null}

			<ListDialog editing={editing} onClose={() => setEditing(null)} />
			<DownloadLinksDialog list={linksFor} onClose={() => setLinksFor(null)} />
			<ConfirmDialog
				open={toDelete !== null}
				title={`Delete “${toDelete?.name ?? ""}”?`}
				description="The contacts stay. They only leave this list. A campaign that uses this list keeps its sending history."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}

function ListDialog({
	editing,
	onClose,
}: {
	editing: Editing;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={editing !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				{editing ? (
					<ListForm
						key={editing.list?.id ?? "new"}
						list={editing.list}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function ListForm({
	list,
	onClose,
}: {
	list: AudienceList | null;
	onClose: () => void;
}) {
	const nameId = useId();
	const descriptionId = useId();
	const cache = useOutreachCache();
	const [name, setName] = useState(list?.name ?? "");
	const [description, setDescription] = useState(list?.description ?? "");

	const save = useMutation({
		mutationFn: () => {
			const input = { name: name.trim(), description: description.trim() };
			return list
				? audienceApi.updateList(list.id, input)
				: audienceApi.createList(input);
		},
		onSuccess: async (saved) => {
			await cache.audience();
			toast.success(`List “${saved.name}” saved.`);
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>{list ? "Edit list" : "New list"}</DialogTitle>
				<DialogDescription>
					A list is a group of contacts one campaign emails.
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={nameId}>Name</FieldLabel>
					<Input
						id={nameId}
						value={name}
						maxLength={100}
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={descriptionId}>
						Description (optional)
					</FieldLabel>
					<Textarea
						id={descriptionId}
						rows={3}
						value={description}
						maxLength={500}
						onChange={(event) => setDescription(event.target.value)}
					/>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button
					disabled={save.isPending || !name.trim()}
					onClick={() => save.mutate()}
				>
					{save.isPending ? "Saving…" : "Save"}
				</Button>
			</DialogFooter>
		</>
	);
}

function DownloadLinksDialog({
	list,
	onClose,
}: {
	list: AudienceList | null;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={list !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				{list ? (
					<DownloadLinksForm key={list.id} list={list} onClose={onClose} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function DownloadLinksForm({
	list,
	onClose,
}: {
	list: AudienceList;
	onClose: () => void;
}) {
	const cache = useOutreachCache();
	const config = useTrackingConfig();
	const [target, setTarget] = useState(() =>
		savedLinkTarget(
			{ destinationUrl: list.linkDestinationUrl, domainId: list.linkDomainId },
			config.data,
		),
	);
	const homepage = config.data?.homepage ?? "";

	const download = useMutation({
		mutationFn: () =>
			downloadFromOutreach(`/lists/${list.id}/links.csv`, {
				destinationUrl: destinationOf(target.path, homepage),
				domainId: target.domainId || undefined,
			}),
		onSuccess: async (filename) => {
			await cache.audience();
			toast.success(
				`Saved ${filename} (${COUNT.format(list.contactCount)} contacts).`,
			);
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>Download links: {list.name}</DialogTitle>
				<DialogDescription>
					One tracking link per contact in the list. Downloading again with the
					same choice gives the same links.
				</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col gap-4">
				<LocalLinksBanner />
				<FieldGroup>
					<LinkTargetFields
						value={target}
						onChange={setTarget}
						config={config.data}
					/>
				</FieldGroup>
			</div>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button
					disabled={download.isPending || !homepage}
					onClick={() => download.mutate()}
				>
					<Icon icon={Download} data-icon="inline-start" />
					{download.isPending ? "Preparing…" : "Download CSV"}
				</Button>
			</DialogFooter>
		</>
	);
}
