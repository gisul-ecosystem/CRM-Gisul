"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import Column from "@carbon/icons-react/es/Column";
import Filter from "@carbon/icons-react/es/Filter";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import Search from "@carbon/icons-react/es/Search";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Icon } from "@crm/ui/components/icon";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { searchParsers } from "@/components/data-table/list-search-params";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CompaniesBulkActions } from "./companies-bulk-actions";
import { companiesSearchParams } from "./companies-search-params";
import styles from "./customers-design.module.css";

type CompanyRow = RouterOutputs["companies"]["list"]["rows"][number];
type Scope = "all" | "mine";

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
					<button type="button" className={styles.filterChip} disabled>
						All Products <Icon icon={ChevronDown} />
					</button>
					<button
						type="button"
						className={styles.filterChip}
						onClick={() =>
							toast.message("Use My companies for owner scope for now.")
						}
					>
						All Owners <Icon icon={ChevronDown} />
					</button>
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
					<button
						type="button"
						className={styles.filterChip}
						onClick={() => toast.message("Column picker is not built yet.")}
					>
						<Icon icon={Column} />
						Columns
					</button>
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
									<th>Product</th>
									<th>Primary Contact</th>
									<th>
										<button type="button" onClick={() => query.toggleSort("owner")}>
											Owner
										</button>
									</th>
									<th>
										<button type="button" onClick={() => query.toggleSort("deals")}>
											Open Deals
										</button>
									</th>
									<th>
										<button
											type="button"
											onClick={() => query.toggleSort("lastActivity")}
										>
											Last Activity
										</button>
									</th>
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
										<td>
											<span className={styles.blank}>—</span>
										</td>
										<td>
											<span className={styles.blank}>—</span>
										</td>
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
										<td>{row.openDealCount}</td>
										<td>
											{row.lastActivityAt ? (
												<LocalRelativeTime date={row.lastActivityAt} />
											) : (
												<span className={styles.blank}>—</span>
											)}
										</td>
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
						Product and primary contact need a backend. Columns stay blank for
						now.
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
	if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
	const p0 = parts[0] ?? "";
	const p1 = parts[1] ?? "";
	return `${p0[0] ?? ""}${p1[0] ?? ""}`.toUpperCase() || "?";
}

function personInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
	const p0 = parts[0] ?? "";
	const p1 = parts[1] ?? "";
	return `${p0[0] ?? ""}${p1[0] ?? ""}`.toUpperCase() || "?";
}
