"use client";

import Column from "@carbon/icons-react/es/Column";
import Filter from "@carbon/icons-react/es/Filter";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import Search from "@carbon/icons-react/es/Search";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { contactName } from "@/components/crm/contact-name";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { searchParsers } from "@/components/data-table/list-search-params";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ContactsBulkActions } from "../contacts/contacts-bulk-actions";
import { contactsSearchParams } from "../contacts/contacts-search-params";
import { LeadsFilters } from "../contacts/leads-filters";
import styles from "./customers-design.module.css";
import { useColumnVisibility } from "./use-column-visibility";

type ContactRow = RouterOutputs["contacts"]["list"]["rows"][number];
type Scope = "all" | "mine";

export function CustomersContactsTable() {
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const trpc = useTRPC();
	const table = useTableQuery(contactsSearchParams);
	const { query, input, setArchived } = table;
	const [{ q }, setSearch] = useQueryStates(searchParsers);
	const [searchValue, setSearchValue] = useSearchInput(q, (next) =>
		setSearch({ q: next, page: 1 }),
	);
	const [scope, setScope] = useState<Scope>("all");
	const me = useQuery(trpc.users.me.queryOptions());
	const columns = useColumnVisibility<"email" | "owner" | "nextFollowUp">(
		"crm.customer-contacts.columns.v1",
		{ email: true, owner: true, nextFollowUp: true },
	);

	const listInput =
		scope === "mine" && me.data?.id
			? { ...input, owner: [me.data.id] }
			: input;

	const contacts = useQuery({
		...trpc.contacts.list.queryOptions(listInput),
		placeholderData: (previous) => previous,
	});

	const rows = contacts.data?.rows ?? [];
	const total = contacts.data?.total ?? 0;
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);
	const settledIds = useMemo(() => {
		const matching = new Set(
			rows
				.filter((row) => Boolean(row.archivedAt) === input.archived)
				.map((row) => row.id),
		);
		return selection.ids.filter((id) => matching.has(id));
	}, [rows, input.archived, selection.ids]);

	const pageSize = query.pageSize;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className={styles.wrap}>
			<div className={styles.toolbar}>
				<label className={styles.search}>
					<Icon icon={Search} />
					<input
						value={searchValue}
						onChange={(event) => setSearchValue(event.target.value)}
						placeholder="Search leads, customers, deals, activities..."
						autoComplete="off"
					/>
				</label>
				<div className={styles.scope}>
					<button
						type="button"
						className={`${styles.scopeBtn} ${scope === "all" ? styles.scopeOn : ""}`}
						onClick={() => setScope("all")}
					>
						All companies
					</button>
					<button
						type="button"
						className={`${styles.scopeBtn} ${scope === "mine" ? styles.scopeOn : ""}`}
						onClick={() => setScope("mine")}
					>
						My companies
					</button>
				</div>
				<div className={styles.filters}>
					<LeadsFilters
						selected={{
							product: input.product,
							leadStatus: input.leadStatus,
							leadSource: input.leadSource,
							owner: scope === "mine" ? [] : input.owner,
						}}
						onChange={(id, next) => {
							if (id === "owner" && scope === "mine") setScope("all");
							selection.clear();
							query.setFilter(id, next);
						}}
					/>
					<button
						type="button"
						className={styles.filterChip}
						onClick={() => {
							const next = !input.archived;
							selection.clear();
							if (!next && query.sort === "archivedAt") query.setSort("");
							setArchived(next);
						}}
					>
						<Icon icon={Filter} />
						{input.archived ? "Active" : "Archived"}
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button type="button" className={styles.filterChip}>
								<Icon icon={Column} />
								Columns
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-44">
							<DropdownMenuLabel>Visible columns</DropdownMenuLabel>
							<DropdownMenuCheckboxItem
								checked={columns.visible.email}
								onCheckedChange={() => columns.toggle("email")}
								onSelect={(event) => event.preventDefault()}
							>
								Email
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={columns.visible.owner}
								onCheckedChange={() => columns.toggle("owner")}
								onSelect={(event) => event.preventDefault()}
							>
								Owner
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={columns.visible.nextFollowUp}
								onCheckedChange={() => columns.toggle("nextFollowUp")}
								onSelect={(event) => event.preventDefault()}
							>
								Next follow-up
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<section className={styles.card}>
				{settledIds.length > 0 ? (
					<div className={styles.bulkBar}>
						<span>{settledIds.length} selected</span>
						<ContactsBulkActions
							ids={settledIds}
							onDone={selection.clear}
							archived={input.archived}
						/>
					</div>
				) : null}

				{rows.length === 0 ? (
					<div className={styles.empty}>
						{input.archived
							? "No archived contacts."
							: contacts.isFetching
								? "Loading contacts…"
								: "No contacts match this view."}
					</div>
				) : (
					<div className={styles.tableScroll}>
						<table className={styles.table}>
							<thead>
								<tr>
									<th>
										<Checkbox
											checked={selection.allSelected}
											aria-label="Select every row on this page"
											onCheckedChange={(checked) =>
												selection.toggleAll(checked === true)
											}
										/>
									</th>
									<th>
										<button type="button" onClick={() => query.toggleSort("name")}>
											Contact
										</button>
									</th>
									<th>
										<button
											type="button"
											onClick={() => query.toggleSort("company")}
										>
											Company
										</button>
									</th>
									{columns.visible.email ? (
										<th>
											<button
												type="button"
												onClick={() => query.toggleSort("email")}
											>
												Email
											</button>
										</th>
									) : null}
									{columns.visible.owner ? (
										<th>
											<button
												type="button"
												onClick={() => query.toggleSort("owner")}
											>
												Owner
											</button>
										</th>
									) : null}
									{columns.visible.nextFollowUp ? (
										<th>Next follow-up</th>
									) : null}
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr
										key={row.id}
										onMouseEnter={() =>
											prefetchRecord({ kind: "contact", id: row.id })
										}
										onClick={() => openRecord({ kind: "contact", id: row.id })}
									>
										<td onClick={(event) => event.stopPropagation()}>
											<Checkbox
												checked={selection.has(row.id)}
												aria-label={`Select ${contactName(row)}`}
												onCheckedChange={(checked) =>
													selection.toggle(row.id, checked === true)
												}
											/>
										</td>
										<td>
											<div className={styles.entity}>
												<span className={styles.av}>
													{initials(row)}
												</span>
												<span className={styles.entityText}>
													<b>{contactName(row)}</b>
													<small>{row.title || "—"}</small>
												</span>
											</div>
										</td>
										<td>
											<div className={styles.entityText}>
												<b>{row.company?.name ?? "—"}</b>
												<small>{row.company?.domain ?? "—"}</small>
											</div>
										</td>
										{columns.visible.email ? (
											<td>
												{row.email ?? <span className={styles.blank}>—</span>}
											</td>
										) : null}
										{columns.visible.owner ? (
											<td>
												{row.owner ? (
													<span className={styles.owner}>
														{row.owner.image ? (
															<img
																src={row.owner.image}
																alt=""
																className={styles.ownerImg}
															/>
														) : (
															<span className={`${styles.av} ${styles.avSm}`}>
																{personInitials(row.owner.name)}
															</span>
														)}
														{row.owner.name}
													</span>
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
										) : null}
										{columns.visible.nextFollowUp ? (
											<td>
												{row.nextFollowUpAt ? (
													<LocalRelativeTime date={row.nextFollowUpAt} />
												) : (
													<span className={styles.blank}>Not scheduled</span>
												)}
											</td>
										) : null}
										<td onClick={(event) => event.stopPropagation()}>
											<button
												type="button"
												className={styles.more}
												aria-label="More actions"
												onClick={() =>
													openRecord({ kind: "contact", id: row.id })
												}
											>
												<Icon icon={OverflowMenuHorizontal} />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<div className={styles.footer}>
					<p className={styles.note}>
						Follow-up dates come from each contact record.
					</p>
					<TablePagination
						page={query.page}
						totalPages={totalPages}
						pageSize={pageSize}
						total={total}
						onPageChange={(page) => query.setPage(page)}
						loading={contacts.isFetching}
					/>
				</div>
			</section>
		</div>
	);
}

function initials(contact: ContactRow): string {
	const first = contact.firstName.trim().charAt(0);
	const last = contact.lastName?.trim().charAt(0) ?? "";
	return `${first}${last}`.toUpperCase() || "?";
}

function personInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
