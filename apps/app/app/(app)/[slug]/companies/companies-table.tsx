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
import { ProductMark } from "@/components/crm/product-mark";
import { searchParsers } from "@/components/data-table/list-search-params";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CompaniesBulkActions } from "./companies-bulk-actions";
import { CompaniesFilters } from "./companies-filters";
import { companiesSearchParams } from "./companies-search-params";
import styles from "./customers-design.module.css";
import { useColumnVisibility } from "./use-column-visibility";

type CompanyRow = RouterOutputs["companies"]["list"]["rows"][number];
type Scope = "all" | "mine";
type ColumnId =
	| "product"
	| "primaryContact"
	| "owner"
	| "openDeals"
	| "lastActivity";

const COLUMN_LABELS: Record<ColumnId, string> = {
	product: "Product",
	primaryContact: "Primary Contact",
	owner: "Owner",
	openDeals: "Open Deals",
	lastActivity: "Last Activity",
};

export function CompaniesTable() {
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const trpc = useTRPC();
	const table = useTableQuery(companiesSearchParams);
	const { query, input, setArchived } = table;
	const [{ q }, setSearch] = useQueryStates(searchParsers);
	const [searchValue, setSearchValue] = useSearchInput(q, (next) =>
		setSearch({ q: next, page: 1 }),
	);
	const [scope, setScope] = useState<Scope>("all");
	const me = useQuery(trpc.users.me.queryOptions());
	const columns = useColumnVisibility<ColumnId>(
		"crm.companies.columns.v1",
		{
			product: true,
			primaryContact: true,
			owner: true,
			openDeals: true,
			lastActivity: true,
		},
	);

	const listInput =
		scope === "mine" && me.data?.id
			? { ...input, owner: [me.data.id] }
			: input;

	const companies = useQuery({
		...trpc.companies.list.queryOptions(listInput),
		placeholderData: (previous) => previous,
	});

	const rows = companies.data?.rows ?? [];
	const total = companies.data?.total ?? 0;
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
						placeholder="Search companies…"
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
					<CompaniesFilters
						selected={{
							product: input.product ?? [],
							owner: scope === "mine" ? [] : (input.owner ?? []),
						}}
						onChange={(id, next) => {
							if (id === "owner" && scope === "mine") setScope("all");
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
							{(Object.keys(COLUMN_LABELS) as ColumnId[]).map((id) => (
								<DropdownMenuCheckboxItem
									key={id}
									checked={columns.visible[id]}
									onCheckedChange={() => columns.toggle(id)}
									onSelect={(event) => event.preventDefault()}
								>
									{COLUMN_LABELS[id]}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<section className={styles.card}>
				{settledIds.length > 0 ? (
					<div className={styles.bulkBar}>
						<span>{settledIds.length} selected</span>
						<CompaniesBulkActions
							ids={settledIds}
							onDone={selection.clear}
							archived={input.archived}
						/>
					</div>
				) : null}

				{rows.length === 0 ? (
					<div className={styles.empty}>
						{input.archived
							? "No archived companies."
							: companies.isFetching
								? "Loading companies…"
								: "No companies match this view."}
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
											Company
										</button>
									</th>
									{columns.visible.product ? <th>Product</th> : null}
									{columns.visible.primaryContact ? (
										<th>Primary Contact</th>
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
									{columns.visible.openDeals ? (
										<th>
											<button
												type="button"
												onClick={() => query.toggleSort("deals")}
											>
												Open Deals
											</button>
										</th>
									) : null}
									{columns.visible.lastActivity ? (
										<th>
											<button
												type="button"
												onClick={() => query.toggleSort("lastActivity")}
											>
												Last Activity
											</button>
										</th>
									) : null}
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr
										key={row.id}
										onMouseEnter={() =>
											prefetchRecord({ kind: "company", id: row.id })
										}
										onClick={() => openRecord({ kind: "company", id: row.id })}
									>
										<td onClick={(event) => event.stopPropagation()}>
											<Checkbox
												checked={selection.has(row.id)}
												aria-label={`Select ${row.name}`}
												onCheckedChange={(checked) =>
													selection.toggle(row.id, checked === true)
												}
											/>
										</td>
										<td>
											<div className={styles.entity}>
												<span className={styles.av}>
													{companyInitials(row.name)}
												</span>
												<span className={styles.entityText}>
													<b>{row.name}</b>
													<small>{row.domain ?? "—"}</small>
												</span>
											</div>
										</td>
										{columns.visible.product ? (
											<td>
												{row.product ? (
													<span className={styles.owner}>
														<ProductMark
															name={row.product.name}
															color={row.product.color}
															iconUrl={row.product.iconUrl}
															className={`${styles.av} ${styles.avSm}`}
														/>
														{row.product.name}
													</span>
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
										) : null}
										{columns.visible.primaryContact ? (
											<td>
												{row.primaryContact ? (
													<span className={styles.entityText}>
														<b>{contactName(row.primaryContact)}</b>
														<small>
															{row.primaryContact.title ||
																row.primaryContact.email ||
																"—"}
														</small>
													</span>
												) : (
													<span className={styles.blank}>—</span>
												)}
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
										{columns.visible.openDeals ? (
											<td>{row.openDealCount}</td>
										) : null}
										{columns.visible.lastActivity ? (
											<td>
												{row.lastActivityAt ? (
													<LocalRelativeTime date={row.lastActivityAt} />
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
										) : null}
										<td onClick={(event) => event.stopPropagation()}>
											<button
												type="button"
												className={styles.more}
												aria-label="More actions"
												onClick={() =>
													openRecord({ kind: "company", id: row.id })
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
						Product comes from the primary contact or an open deal.
					</p>
					<TablePagination
						page={query.page}
						totalPages={totalPages}
						pageSize={pageSize}
						total={total}
						onPageChange={(page) => query.setPage(page)}
						loading={companies.isFetching}
					/>
				</div>
			</section>
		</div>
	);
}

function companyInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0]?.charAt(0) ?? "";
	const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? "") : "";
	return `${first}${second}`.toUpperCase() || "?";
}

function personInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0]?.charAt(0) ?? "";
	const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
	return `${first}${last}`.toUpperCase() || "?";
}
