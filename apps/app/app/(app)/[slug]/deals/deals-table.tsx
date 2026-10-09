"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Email from "@carbon/icons-react/es/Email";
import Grid from "@carbon/icons-react/es/Grid";
import List from "@carbon/icons-react/es/List";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Search from "@carbon/icons-react/es/Search";
import { DealStage } from "@crm/db/enums";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Icon } from "@crm/ui/components/icon";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { ProductMark } from "@/components/crm/product-mark";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { searchParsers } from "@/components/data-table/list-search-params";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DealsAnalytics } from "./deals-analytics";
import { DealsBulkActions } from "./deals-bulk-actions";
import styles from "./deals-design.module.css";
import { DealsFilters } from "./deals-filters";
import { dealsSearchParams } from "./deals-search-params";

type DealRow = RouterOutputs["deals"]["list"]["rows"][number];

const STAGE_PILL: Record<
	DealStage,
	{ label: string; className: string }
> = {
	[DealStage.DEMO_BOOKED]: {
		label: "New",
		className: styles.stageNew ?? "",
	},
	[DealStage.QUALIFIED_TO_BUY]: {
		label: "Qualified",
		className: styles.stageQualified ?? "",
	},
	[DealStage.DECISION_MAKER_BOUGHT_IN]: {
		label: "Proposal",
		className: styles.stageProposal ?? "",
	},
	[DealStage.CONTRACT_SENT]: {
		label: "Negotiation",
		className: styles.stageNegotiation ?? "",
	},
	[DealStage.CLOSED_WON]: {
		label: "Won",
		className: styles.stageWon ?? "",
	},
	[DealStage.CLOSED_LOST]: {
		label: "Lost",
		className: styles.stageLost ?? "",
	},
	[DealStage.UNQUALIFIED_TO_BUY]: {
		label: "Lost",
		className: styles.stageLost ?? "",
	},
};

export function DealsTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const { query, input, setArchived } = useTableQuery(dealsSearchParams);
	const [{ q }, setSearch] = useQueryStates(searchParsers);
	const [searchValue, setSearchValue] = useSearchInput(q, (next) =>
		setSearch({ q: next, page: 1 }),
	);
	const [view, setView] = useState<"list" | "grid">("list");

	const deals = useQuery({
		...trpc.deals.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const rows = deals.data?.rows ?? [];
	const total = deals.data?.total ?? 0;
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
	const facetCounts = deals.data?.facetCounts;

	return (
		<div className={styles.wrap}>
			<DealsAnalytics facetCounts={facetCounts} total={total} />

			<div className={styles.toolbar}>
				<label className={styles.search}>
					<Icon icon={Search} />
					<input
						value={searchValue}
						onChange={(event) => setSearchValue(event.target.value)}
						placeholder="Search deals..."
						autoComplete="off"
					/>
				</label>
				<div className={styles.filters}>
					<DealsFilters
						selected={{
							product: input.product,
							stage: input.stage,
							company: input.company,
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
						onClick={() => setView("grid")}
					>
						<Icon icon={Grid} />
					</button>
				</div>
			</div>

			<section className={`${styles.card} ${styles.tableCard}`}>
				{settledIds.length > 0 ? (
					<div className={styles.bulkBar}>
						<span>{settledIds.length} selected</span>
						<DealsBulkActions
							ids={settledIds}
							onDone={selection.clear}
							archived={input.archived}
						/>
					</div>
				) : null}

				{rows.length === 0 ? (
					<div className={styles.empty}>
						{input.archived
							? "No archived deals."
							: deals.isFetching
								? "Loading deals…"
								: "No deals match this view."}
					</div>
				) : view === "grid" ? (
					<div className={styles.cardGrid}>
						{rows.map((row) => {
							const stage = STAGE_PILL[row.stage];
							return (
								<button
									key={row.id}
									type="button"
									className={styles.dealCard}
									onMouseEnter={() =>
										prefetchRecord({ kind: "deal", id: row.id })
									}
									onClick={() => openRecord({ kind: "deal", id: row.id })}
								>
									<div className={styles.dealCardTop}>
										<span className={styles.dealName}>{row.name}</span>
										<span className={`${styles.pill} ${stage.className}`}>
											{stage.label}
										</span>
									</div>
									<div className={styles.dealCardMeta}>
										<span>{row.company?.name ?? "No company"}</span>
										<span>{row.product?.name ?? "No product"}</span>
										<span>
											{row.amountCents === null
												? "No value"
												: formatMoney(row.amountCents, row.currency)}
										</span>
										<span>
											{row.owner?.name.split(/\s+/)[0] ?? "Unassigned"}
										</span>
									</div>
								</button>
							);
						})}
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
									<th>Deal Name</th>
									<th>Company</th>
									<th>Product</th>
									<th>Stage</th>
									<th>Value</th>
									<th>Owner</th>
									<th>Close Date</th>
									<th>Last Activity</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => {
									const stage = STAGE_PILL[row.stage];
									return (
										<tr
											key={row.id}
											onMouseEnter={() =>
												prefetchRecord({ kind: "deal", id: row.id })
											}
											onClick={() =>
												openRecord({ kind: "deal", id: row.id })
											}
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
												<span className={styles.dealName}>{row.name}</span>
											</td>
											<td>
												{row.company ? (
													<span className={styles.company}>
														<span className={styles.companyIcon}>
															{row.company.name.charAt(0).toUpperCase()}
														</span>
														{row.company.name}
													</span>
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
											<td>
												{row.product ? (
													<span className={styles.company}>
														<ProductMark
															name={row.product.name}
															color={row.product.color}
															iconUrl={row.product.iconUrl}
															className={styles.companyIcon}
														/>
														{row.product.name}
													</span>
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
											<td>
												<span
													className={`${styles.pill} ${stage.className}`}
												>
													{stage.label}
												</span>
											</td>
											<td>
												{row.amountCents === null ? (
													<span className={styles.blank}>—</span>
												) : (
													<span className="tabular-nums">
														{formatMoney(row.amountCents, row.currency)}
													</span>
												)}
											</td>
											<td>
												{row.owner ? (
													<span className={styles.owner}>
														<span className={styles.av}>
															{ownerInitials(row.owner.name)}
														</span>
														{row.owner.name.split(/\s+/)[0]}
													</span>
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
											<td>
												{row.expectedCloseDate ? (
													<LocalDay date={row.expectedCloseDate} />
												) : (
													<span className={styles.blank}>—</span>
												)}
											</td>
											<td>
												{row.lastActivityAt ? (
													<span className={styles.activity}>
														<Icon icon={Email} />
														<LocalRelativeTime date={row.lastActivityAt} />
													</span>
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
														openRecord({ kind: "deal", id: row.id })
													}
												>
													<Icon icon={OverflowMenuVertical} />
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				<div className={styles.footer}>
					<p className={styles.note}>
						Manage products in Settings → Products.
					</p>
					<TablePagination
						page={query.page}
						totalPages={totalPages}
						pageSize={pageSize}
						total={total}
						onPageChange={(page) => query.setPage(page)}
						loading={deals.isFetching}
					/>
				</div>
			</section>
		</div>
	);
}

function ownerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0]?.charAt(0) ?? "";
	const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
	return `${first}${last}`.toUpperCase() || "?";
}
