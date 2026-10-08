"use client";

import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import Email from "@carbon/icons-react/es/Email";
import Phone from "@carbon/icons-react/es/Phone";
import Video from "@carbon/icons-react/es/Video";
import View from "@carbon/icons-react/es/View";
import { Checkbox } from "@crm/ui/components/checkbox";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import { formatMoneyCompact } from "@crm/ui/lib/format";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { contactsSearchParams } from "@/app/(app)/[slug]/contacts/contacts-search-params";
import { contactName } from "@/components/crm/contact-name";
import { LocalRelativeTime } from "@/components/local-date-time";
import { activityIcon, activityLabel } from "@/lib/activity-presentation";
import { LEAD_SOURCE_OPTIONS, leadSourceLabel } from "@/lib/lead-fields";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	chartBarPercent,
	chartTopCents,
	chartYLabels,
} from "./dashboard-chart";
import styles from "./dashboard-design.module.css";
import { overviewParsers } from "./overview-search-params";
import { SalesDashboard } from "./sales-dashboard";

type Task = RouterOutputs["activities"]["myTasks"][number];
type ContactRow = RouterOutputs["contacts"]["list"]["rows"][number];
type DashboardSummaryData = RouterOutputs["dashboard"]["summary"];
type PriorityTab = "today" | "overdue" | "upcoming";

const SOURCE_BAR_COLORS = [
	"#5f3fa3",
	"#5f3fa3",
	"#b79ce8",
	"#a888e0",
	"#c9b6ee",
	"#ddd0f5",
	"#e8e4f2",
] as const;

const RECENT_LEADS_INPUT = {
	...contactsSearchParams.defaultInput(),
	pageSize: 4,
	sort: "createdAt",
	dir: "desc" as const,
};

export function DashboardSummary() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const workspaceUrl = useWorkspaceUrl();
	const [tab, setTab] = useState<PriorityTab>("today");
	const [scope] = useQueryState(
		SEARCH_PARAM.overview.scope,
		overviewParsers[SEARCH_PARAM.overview.scope],
	);
	const [month] = useQueryState(
		SEARCH_PARAM.overview.month,
		overviewParsers[SEARCH_PARAM.overview.month],
	);

	const summaryQuery = useQuery({
		...trpc.dashboard.summary.queryOptions({
			scope,
			...(month ? { month } : {}),
		}),
		placeholderData: (previous) => previous,
	});
	const leadsQuery = useQuery(trpc.contacts.list.queryOptions(RECENT_LEADS_INPUT));
	const tasksQuery = useQuery(
		trpc.activities.myTasks.queryOptions({ window: "all", limit: 50 }),
	);
	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const summary = summaryQuery.data;
	if (!summary) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const grouped = groupTasks(tasksQuery.data ?? []);
	const visible = grouped[tab].slice(0, 5);
	const trend = summary.trend;
	const maxWon = trend.reduce((m, p) => Math.max(m, p.won), 0);
	const chartTop = chartTopCents(maxWon);
	const yLabels = chartYLabels(maxWon, summary.reportingCurrency);
	const lastIdx = Math.max(trend.length - 1, 0);

	return (
		<div className={styles.wrap}>
			<SalesDashboard summary={summary} />

			<section className={styles.grid2}>
				<div className={`${styles.card} ${styles.panel}`}>
					<div className={styles.head}>
						<h2 className={styles.panelTitle}>Today&apos;s Priorities</h2>
						<Link href={workspaceUrl("/deals")} className={styles.linkSm}>
							View All <Icon icon={ArrowRight} />
						</Link>
					</div>
					<div className={styles.tabs}>
						{(
							[
								["today", "Today"],
								["overdue", "Overdue"],
								["upcoming", "Upcoming"],
							] as const
						).map(([id, label]) => (
							<button
								key={id}
								type="button"
								className={[
									styles.tab,
									tab === id ? styles.tabOn : "",
									id === "overdue" ? styles.tabOd : "",
								]
									.filter(Boolean)
									.join(" ")}
								onClick={() => setTab(id)}
							>
								{label}{" "}
								<span className={styles.tabBadge}>{grouped[id].length}</span>
							</button>
						))}
					</div>

					{visible.length === 0 ? (
						<p className={styles.note}>No tasks in this list.</p>
					) : (
						<div className={styles.taskList}>
							{visible.map((task) => {
								const action = taskAction(task, workspaceUrl);
								return (
									<div key={task.id} className={styles.task}>
										<Checkbox
											checked={false}
											disabled={complete.isPending}
											aria-label="Mark as done"
											onCheckedChange={() =>
												complete.mutate({ id: task.id, completed: true })
											}
										/>
										<span className={`${styles.tic} ${toneFor(task.type)}`}>
											<Icon icon={activityIcon(task.type)} />
										</span>
										<div className={styles.taskText}>
											<b>{task.subject ?? "Task"}</b>
											<small>
												{task.deal
													? `Deal · ${task.deal.name}`
													: task.company
														? `Company · ${task.company.name}`
														: "Unlinked"}
											</small>
										</div>
										<span className={styles.taskTime}>
											{task.dueAt
												? new Date(task.dueAt).toLocaleTimeString([], {
														hour: "numeric",
														minute: "2-digit",
													})
												: "—"}
										</span>
										<Link
											href={action.href}
											className={`${styles.btn} ${action.variant === "dark" ? styles.btnDark : ""} ${action.variant === "ghost" ? styles.btnGhost : ""}`}
										>
											<Icon icon={action.icon} />
											{action.label}
										</Link>
									</div>
								);
							})}
						</div>
					)}
				</div>

				<div className={`${styles.card} ${styles.panel}`}>
					<div className={styles.head}>
						<h2 className={styles.panelTitle}>Recent Leads</h2>
						<Link href={workspaceUrl("/contacts")} className={styles.linkSm}>
							View All <Icon icon={ArrowRight} />
						</Link>
					</div>
					{leadsQuery.isLoading ? (
						<p className={styles.note}>Loading contacts…</p>
					) : (leadsQuery.data?.rows.length ?? 0) === 0 ? (
						<p className={styles.note}>No contacts yet.</p>
					) : (
						<div className={styles.tableScroll}>
							<table className={styles.table}>
								<thead>
									<tr>
										<th>Name</th>
										<th>Company</th>
										<th>Product</th>
										<th>Status</th>
										<th>Created</th>
									</tr>
								</thead>
								<tbody>
									{leadsQuery.data?.rows.map((lead) => (
										<tr key={lead.id}>
											<td>
												<Link
													href={workspaceUrl(`/contacts/${lead.id}`)}
													className={styles.who}
												>
													<span className={styles.av}>
														{initials(lead)}
													</span>
													{contactName(lead)}
												</Link>
											</td>
											<td>{lead.company?.name ?? "—"}</td>
											<td>—</td>
											<td>—</td>
											<td>
												<LocalRelativeTime date={lead.createdAt} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className={styles.note}>
						Product and status need a backend. Columns stay blank for now.
					</p>
				</div>
			</section>

			<section className={styles.grid3}>
				<div className={`${styles.card} ${styles.p3}`}>
					<div className={styles.head}>
						<h2 className={styles.p3Title}>Deal Performance</h2>
					</div>
					<div className={styles.sels}>
						<span className={styles.sel}>Won revenue</span>
						<span className={styles.sel}>Last 6 months</span>
					</div>
					<div className={styles.chart}>
						<div className={styles.yl}>
							{yLabels.map((label, index) => (
								<span key={`y-${index}`}>{label}</span>
							))}
						</div>
						<div className={styles.bars}>
							{trend.map((point, index) => {
								const h = chartBarPercent(point.won, chartTop);
								const on = index === lastIdx;
								return (
									<div
										key={`${point.month}-${index}`}
										className={styles.bw}
										style={
											on
												? ({ "--h": `${Math.max(h, 1)}%` } as CSSProperties)
												: undefined
										}
									>
										<div
											className={`${styles.bar} ${on ? styles.barOn : ""}`}
											style={{ height: `${h}%` }}
										/>
										{on ? (
											<div className={styles.tip}>
												<b>
													{formatMoneyCompact(
														point.won,
														summary.reportingCurrency,
													)}
												</b>
												<small>{point.month}</small>
											</div>
										) : null}
									</div>
								);
							})}
						</div>
					</div>
					<div className={styles.xl}>
						<span />
						<div className={styles.xlRow}>
							{trend.map((point, index) => (
								<span
									key={`${point.month}-${index}`}
									className={index === lastIdx ? styles.xlOn : undefined}
								>
									{point.month.slice(0, 3)}
								</span>
							))}
						</div>
					</div>
				</div>

				<div className={`${styles.card} ${styles.p3}`}>
					<div className={styles.head}>
						<h2 className={styles.p3Title}>Leads by Source</h2>
						<Link href={workspaceUrl("/contacts")} className={styles.linkSm}>
							View All <Icon icon={ArrowRight} />
						</Link>
					</div>
					<div className={styles.src}>
						{leadSourceRows(summary.leadSources).map((row) => (
							<div key={row.label} className={styles.srcRow}>
								{row.label}
								<span className={styles.tr}>
									<span
										className={styles.trFill}
										style={{
											width: `${row.pct}%`,
											background: row.color,
										}}
									/>
								</span>
								<span className={styles.srcPct}>{row.pct}%</span>
							</div>
						))}
					</div>
					{summary.leadSources.every((row) => row.count === 0) ? (
						<p className={styles.note}>No lead sources yet.</p>
					) : null}
				</div>

				<div className={`${styles.card} ${styles.p3}`}>
					<div className={styles.head}>
						<h2 className={styles.p3Title}>Product Performance</h2>
					</div>
					{summary.productPerformance.length === 0 ? (
						<p className={styles.note}>
							No products yet. Add products in Settings → Products.
						</p>
					) : (
						<div className={styles.tableScroll}>
							<table className={styles.pt}>
								<thead>
									<tr>
										<th>Product</th>
										<th>Leads</th>
										<th>Deals</th>
										<th>Won</th>
										<th>Pipeline</th>
									</tr>
								</thead>
								<tbody>
									{summary.productPerformance.map((row) => (
										<tr key={row.id}>
											<td>
												<span
													className={styles.dot}
													style={{ background: row.color }}
												/>
												<b>{row.name}</b>
											</td>
											<td>{row.leads}</td>
											<td>{row.deals}</td>
											<td>{row.won}</td>
											<td>
												<b>
													{formatMoneyCompact(
														row.pipelineCents,
														summary.reportingCurrency,
													)}
												</b>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</section>

			<section className={`${styles.card} ${styles.act}`}>
				<h2 className={styles.actTitle}>Recent Activity</h2>
				{summary.recentActivity.length === 0 ? (
					<div className="py-8 text-center text-sm text-neutral-400">
						No recent activities recorded yet.
					</div>
				) : (
					<div className={styles.alist}>
						{summary.recentActivity.slice(0, 6).map((entry) => {
							const date = new Date(entry.createdAt);
							const hours = date.getHours();
							const minutes = date.getMinutes();
							const ampm = hours >= 12 ? "PM" : "AM";
							const formattedHour = hours % 12 || 12;
							const formattedMinute = String(minutes).padStart(2, "0");
							const timeStr = `${formattedHour}:${formattedMinute} ${ampm}`;

							const item = {
								id: entry.id,
								time: timeStr,
								tone: "tBlue" as const,
								body: entry.subject ?? activityLabel(entry.type),
								meta:
									entry.company?.name ??
									entry.deal?.name ??
									entry.createdBy.name,
								icon: activityIcon(entry.type),
							};
							return (
								<div key={item.id} className={styles.ai}>
									<span className={`${styles.tic} ${styles[item.tone]}`}>
										{item.icon ? <Icon icon={item.icon} /> : "•"}
									</span>
									<div>
										<time suppressHydrationWarning>{item.time}</time>
										<p>{item.body}</p>
										{item.meta ? (
											<small className={styles.aiMeta}>{item.meta}</small>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}

function leadSourceRows(rows: DashboardSummaryData["leadSources"]) {
	const total = rows.reduce((sum, row) => sum + row.count, 0);
	const withCounts = rows.filter((row) => row.count > 0);
	const ordered =
		withCounts.length > 0
			? withCounts
			: LEAD_SOURCE_OPTIONS.map((option) => ({
					source: option.value,
					count: 0,
				}));

	return ordered.map((row, index) => {
		const label =
			row.source === null ? "No source" : leadSourceLabel(row.source);
		const color =
			LEAD_SOURCE_OPTIONS.find((option) => option.value === row.source)
				?.color ?? SOURCE_BAR_COLORS[index % SOURCE_BAR_COLORS.length];
		const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
		return { label, pct, color, count: row.count };
	});
}

function initials(contact: ContactRow): string {
	const first = contact.firstName.trim().charAt(0);
	const last = contact.lastName?.trim().charAt(0) ?? "";
	return `${first}${last}`.toUpperCase() || "?";
}

function toneFor(type: Task["type"]): string {
	if (type === "CALL") return styles.tPurple;
	if (type === "EMAIL") return styles.tRed;
	if (type === "MEETING") return styles.tBlue;
	if (type === "TASK") return styles.tYellow;
	return styles.tGreen;
}

function taskAction(
	task: Task,
	workspaceUrl: (path?: string) => string,
): {
	label: string;
	icon: CarbonIcon;
	href: string;
	variant: "default" | "dark" | "ghost";
} {
	const href = task.deal
		? workspaceUrl(`/deals/${task.deal.id}`)
		: task.company
			? workspaceUrl(`/companies/${task.company.id}`)
			: workspaceUrl("/");
	if (task.type === "CALL")
		return { label: "Call", icon: Phone, href, variant: "default" };
	if (task.type === "EMAIL")
		return { label: "Email", icon: Email, href, variant: "default" };
	if (task.type === "MEETING")
		return { label: "Join", icon: Video, href, variant: "dark" };
	return { label: "View", icon: View, href, variant: "ghost" };
}

function groupTasks(tasks: Task[]): Record<PriorityTab, Task[]> {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	const today: Task[] = [];
	const overdue: Task[] = [];
	const upcoming: Task[] = [];
	for (const task of tasks) {
		if (!task.dueAt) {
			upcoming.push(task);
			continue;
		}
		const due = new Date(task.dueAt);
		if (due < start) overdue.push(task);
		else if (due < end) today.push(task);
		else upcoming.push(task);
	}
	return { today, overdue, upcoming };
}
