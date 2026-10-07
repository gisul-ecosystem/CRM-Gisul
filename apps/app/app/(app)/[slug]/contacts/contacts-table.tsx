"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Calendar from "@carbon/icons-react/es/Calendar";
import Grid from "@carbon/icons-react/es/Grid";
import List from "@carbon/icons-react/es/List";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Renew from "@carbon/icons-react/es/Renew";
import Search from "@carbon/icons-react/es/Search";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Icon } from "@crm/ui/components/icon";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { searchParsers } from "@/components/data-table/list-search-params";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import {
	LEAD_STATUS_TABS,
	leadSourceLabel,
	leadStatusLabel,
} from "@/lib/lead-fields";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { ContactsBulkActions } from "./contacts-bulk-actions";
import { contactsSearchParams } from "./contacts-search-params";
import { LeadsAnalytics } from "./leads-analytics";
import { LeadsFilters } from "./leads-filters";
import styles from "./leads-design.module.css";

type ContactRow = RouterOutputs["contacts"]["list"]["rows"][number];
type StatusTab = (typeof LEAD_STATUS_TABS)[number]["id"];

export function ContactsTable() {
	const openRecord = useOpenRecord();
	const workspaceUrl = useWorkspaceUrl();
	const router = useRouter();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(contactsSearchParams);
	const { query, input, setArchived } = table;
	const [{ q }, setSearch] = useQueryStates(searchParsers);
	const [searchValue, setSearchValue] = useSearchInput(q, (next) =>
		setSearch({ q: next, page: 1 }),
	);
	const [view, setView] = useState<"list" | "grid">("list");
	const statusTab: StatusTab =
		input.leadStatus.length === 1
			? ((input.leadStatus[0]?.toLowerCase() as StatusTab) ?? "all")
			: "all";

	const contacts = useQuery({
		...trpc.contacts.list.queryOptions(input),
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

	const facetCounts = contacts.data?.facetCounts;
	const tabCounts = useMemo(() => {
		const map: Record<string, number> = { all: total };
		for (const tab of LEAD_STATUS_TABS) {
			if (tab.id === "all") continue;
			const key = tab.id.toUpperCase();
			map[tab.id] = facetCounts?.leadStatus?.[key] ?? 0;
		}
		return map;
	}, [total, facetCounts]);

	return (
		<div className={styles.wrap}>
			<LeadsAnalytics facetCounts={facetCounts} />

			<div className={styles.toolbar}>
				<label className={styles.search}>
					<Icon icon={Search} />
					<input
						value={searchValue}
						onChange={(event) => setSearchValue(event.target.value)}
						placeholder="Search leads by name, company, email..."
						autoComplete="off"
					/>
				</label>
				<div className={styles.filters}>
					<LeadsFilters
						selected={{
							product: input.product,
							leadStatus: input.leadStatus,
							leadSource: input.leadSource,
							owner: input.owner,
						}}
						onChange={(id, next) => {
							selection.clear();
							query.setFilter(id, next);
						}}
					/>
					<button
						type="button"
						className={`${styles.filterChip} ${input.archived ? styles.filterChipOn : ""}`}
						onClick={() => {
							const next = !input.archived;
							selection.clear();
							if (!next && query.sort === "archivedAt") query.setSort("");
							setArchived(next);
						}}
					>
						<Icon icon={Archive} />
						{input.archived ? "Active" : "Archived"}
					</button>
				</div>
			</div>

			<div className={styles.tabsRow}>
				<div className={styles.tabs}>
					{LEAD_STATUS_TABS.map((tab) => (
						<button
							key={tab.id}
							type="button"
							className={`${styles.tab} ${statusTab === tab.id ? styles.tabOn : ""}`}
							onClick={() => {
								query.setFilter(
									"leadStatus",
									tab.id === "all" ? [] : [tab.id.toUpperCase()],
								);
							}}
						>
							{tab.label}
							<span className={styles.tabBadge}>{tabCounts[tab.id] ?? 0}</span>
						</button>
					))}
				</div>
				<div className={styles.viewToggle}>
					<button
						type="button"
						className={`${styles.viewBtn} ${view === "list" ? styles.viewBtnOn : ""}`}
						aria-label="List view"
						onClick={() => setView("list")}
					>
						<Icon icon={List} />
					</button>
					<button
						type="button"
						className={`${styles.viewBtn} ${view === "grid" ? styles.viewBtnOn : ""}`}
						aria-label="Grid view"
						onClick={() => {
							setView("grid");
							toast.message("Grid view is not built yet.");
						}}
					>
						<Icon icon={Grid} />
					</button>
				</div>
			</div>

			<section className={`${styles.card} ${styles.tableCard}`}>
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
							? "No archived leads."
							: contacts.isFetching
								? "Loading leads…"
								: "No leads match this view."}
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
									<th>Name</th>
									<th>Company</th>
									<th>Product</th>
									<th>Status</th>
									<th>Source</th>
									<th>Owner</th>
									<th>Last Activity</th>
									<th>Next Follow-up</th>
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
											<div className={styles.who}>
												<span className={styles.av}>
													{initials(row)}
												</span>
												<span className={styles.whoText}>
													<b>{contactName(row)}</b>
													<small>{row.title || row.email || "—"}</small>
												</span>
											</div>
										</td>
										<td>
											<div className={styles.companyCell}>
												<b>{row.company?.name ?? "—"}</b>
												<small>{row.company?.domain ?? "—"}</small>
											</div>
										</td>
										<td>
											{row.product ? (
												<span className={styles.companyCell}>
													<span
														className={styles.av}
														style={{
															background: row.product.color,
															color: "#fff",
														}}
													>
														{row.product.name.charAt(0)}
													</span>
													{row.product.name}
												</span>
											) : (
												<span className={styles.blank}>—</span>
											)}
										</td>
										<td>
											<span className={styles.pill}>
												{leadStatusLabel(row.leadStatus)}
											</span>
										</td>
										<td>
											{row.leadSource ? (
												leadSourceLabel(row.leadSource)
											) : (
												<span className={styles.blank}>—</span>
											)}
										</td>
										<td>
											{row.owner ? (
												<span className={styles.owner}>
													<span className={styles.ownerAv}>
														{ownerInitials(row.owner.name)}
													</span>
													{row.owner.name.split(/\s+/)[0]}
												</span>
											) : (
												<span className={styles.blank}>—</span>
											)}
										</td>
										<td>
											{row.lastActivityAt ? (
												<span className={styles.activity}>
													<LocalRelativeTime date={row.lastActivityAt} />
												</span>
											) : (
												<span className={styles.blank}>—</span>
											)}
										</td>
										<td>
											{row.nextFollowUpAt ? (
												<span className={styles.follow}>
													<Icon icon={Calendar} />
													<LocalRelativeTime date={row.nextFollowUpAt} />
												</span>
											) : (
												<span className={`${styles.follow} ${styles.blank}`}>
													<Icon icon={Calendar} /> —
												</span>
											)}
										</td>
										<td onClick={(event) => event.stopPropagation()}>
											<div className={styles.rowActions}>
												<button
													type="button"
													className={styles.convert}
													onClick={() => {
														if (!row.company) {
															toast.error("Add a company before converting.");
															return;
														}
														router.push(workspaceUrl("/deals?new=true"));
													}}
												>
													<Icon icon={Renew} />
													Convert
												</button>
												<button
													type="button"
													className={styles.more}
													aria-label="More actions"
													onClick={() =>
														openRecord({ kind: "contact", id: row.id })
													}
												>
													<Icon icon={OverflowMenuVertical} />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<div className={styles.footer}>
					<p className={styles.note}>
						Manage products in Settings → Products. Grid
						view are not built yet.
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

function ownerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0]?.charAt(0) ?? "";
	const last =
		parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
	return `${first}${last}`.toUpperCase() || "?";
}

