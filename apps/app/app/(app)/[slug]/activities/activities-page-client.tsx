"use client";

import Add from "@carbon/icons-react/es/Add";
import Building from "@carbon/icons-react/es/Building";
import Calendar from "@carbon/icons-react/es/Calendar";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import CheckmarkOutline from "@carbon/icons-react/es/CheckmarkOutline";
import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Email from "@carbon/icons-react/es/Email";
import Phone from "@carbon/icons-react/es/Phone";
import Search from "@carbon/icons-react/es/Search";
import Task from "@carbon/icons-react/es/Task";
import Time from "@carbon/icons-react/es/Time";
import Video from "@carbon/icons-react/es/Video";
import ArrowDown from "@carbon/icons-react/es/ArrowDown";
import ArrowUp from "@carbon/icons-react/es/ArrowUp";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
	ACTIVITIES,
	type ActivityQuickFilter,
	type ActivityTab,
	type ActivityTypeKey,
	type ActivityViewMode,
} from "./activities-config";
import styles from "./activities-design.module.css";
import {
	ACTIVITY_TYPE_META,
	type ActivityItem,
	activityStatus,
	addDays,
	buildDemoActivities,
	dateKey,
	DAYS,
	demoToday,
	formatTime,
	initials,
	MONTHS,
	parseDateKey,
	weekStart,
} from "./activities-dummy";

const TYPE_ICON: Record<ActivityTypeKey, CarbonIcon> = {
	call: Phone,
	meeting: Video,
	email: Email,
	task: Task,
};

const QUICK_META: {
	key: ActivityQuickFilter;
	label: string;
	icon: CarbonIcon;
}[] = [
	{ key: "all", label: "All Activities", icon: Calendar },
	{ key: "today", label: "Today", icon: Calendar },
	{ key: "week", label: "This Week", icon: Calendar },
	{ key: "upcoming", label: "Upcoming", icon: Calendar },
	{ key: "overdue", label: "Overdue", icon: Time },
	{ key: "completed", label: "Completed", icon: CheckmarkOutline },
];

const TAB_LABELS: Record<ActivityTab, string> = {
	all: "All Activities",
	call: "Calls",
	meeting: "Meetings",
	email: "Emails",
	task: "Tasks",
};

type ScopeMode = "date" | ActivityQuickFilter;

function mapEntryToItem(entry: any): ActivityItem {
	const rawType = String(entry.type).toUpperCase();
	let type: ActivityTypeKey = "task";
	if (rawType === "CALL") type = "call";
	else if (rawType === "MEETING") type = "meeting";
	else if (rawType === "EMAIL") type = "email";
	else if (rawType === "TASK") type = "task";

	const occurredAt = entry.occurredAt ?? entry.dueAt ?? entry.createdAt;
	const dateObj = new Date(occurredAt);
	const min = Number.isNaN(dateObj.getTime())
		? 600
		: dateObj.getHours() * 60 + dateObj.getMinutes();
	const dateStr = Number.isNaN(dateObj.getTime())
		? dateKey(new Date())
		: dateKey(dateObj);

	const isTeams =
		entry.meta?.source === "teams" ||
		Boolean(entry.calendarEvent?.conferenceUrl?.includes("teams.microsoft.com"));
	const defaultTitle = isTeams
		? "Teams Call"
		: type === "call"
			? "Call"
			: type === "meeting"
				? "Meeting"
				: type === "email"
					? "Email"
					: "Task";

	return {
		id: entry.id,
		type,
		title: entry.subject || defaultTitle,
		desc:
			entry.body ||
			entry.calendarEvent?.location ||
			(isTeams ? "Microsoft Teams Online Meeting" : "") ||
			entry.emailThread?.subject ||
			ACTIVITY_TYPE_META[type].desc,
		company:
			entry.company?.name ||
			(entry.contact
				? `${entry.contact.firstName} ${entry.contact.lastName ?? ""}`.trim()
				: ""),
		owner: entry.createdBy?.name || "Rep",
		date: dateStr,
		min,
		done: Boolean(entry.completedAt),
	};
}

export function ActivitiesPageClient() {
	const TODAY = demoToday();
	const todayKey = dateKey(TODAY);
	const dateInputId = useId();
	const dateInputRef = useRef<HTMLInputElement>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: dbActivities } = useQuery(
		trpc.activities.list.queryOptions({
			limit: 200,
		}),
	);

	const [acts, setActs] = useState<ActivityItem[]>(() => {
		return buildDemoActivities();
	});

	useEffect(() => {
		if (dbActivities && dbActivities.length > 0) {
			const liveItems = dbActivities.map(mapEntryToItem);
			setActs(liveItems);
		}
	}, [dbActivities]);

	const completeMutation = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.activities.list.queryKey(),
				});
			},
		}),
	);

	const [nextId, setNextId] = useState(200);
	const [sel, setSel] = useState(() => new Date(TODAY));
	const [cal, setCal] = useState(() => ({
		y: TODAY.getFullYear(),
		m: TODAY.getMonth(),
	}));
	const [mode, setMode] = useState<ScopeMode>("date");
	const [vmode, setVmode] = useState<ActivityViewMode>("list");
	const [tab, setTab] = useState<ActivityTab>("all");
	const [filtType, setFiltType] = useState("");
	const [filtStatus, setFiltStatus] = useState("");
	const [filtOwner, setFiltOwner] = useState("");
	const [query, setQuery] = useState("");
	const [enabled, setEnabled] = useState<Record<ActivityTypeKey, boolean>>({
		call: true,
		meeting: true,
		email: true,
		task: true,
	});
	const [modalOpen, setModalOpen] = useState(false);
	const [toastMsg, setToastMsg] = useState("");
	const [toastOn, setToastOn] = useState(false);

	function toast(message: string) {
		setToastMsg(message);
		setToastOn(true);
		if (toastTimer.current) clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToastOn(false), 1800);
	}

	function pick(d: Date) {
		setSel(new Date(d));
		setCal({ y: d.getFullYear(), m: d.getMonth() });
		setMode("date");
	}

	function inWeek(a: ActivityItem, d: Date) {
		const start = dateKey(weekStart(d));
		const end = dateKey(addDays(weekStart(d), 6));
		return a.date >= start && a.date <= end;
	}

	function scopeMatch(a: ActivityItem, key: ActivityQuickFilter) {
		if (key === "all") return true;
		if (key === "today") return a.date === todayKey;
		if (key === "week") return inWeek(a, TODAY);
		if (key === "upcoming") return !a.done && a.date > todayKey;
		if (key === "overdue") return activityStatus(a, todayKey) === "overdue";
		return a.done;
	}

	function inScope(a: ActivityItem) {
		if (mode === "date") {
			return vmode === "week" ? inWeek(a, sel) : a.date === dateKey(sel);
		}
		return scopeMatch(a, mode);
	}

	const visible = acts
		.filter((a) => {
			const q = query.trim().toLowerCase();
			return (
				inScope(a) &&
				enabled[a.type] &&
				(tab === "all" || a.type === tab) &&
				(!filtType || a.type === filtType) &&
				(!filtStatus || activityStatus(a, todayKey) === filtStatus) &&
				(!filtOwner || a.owner === filtOwner) &&
				(!q ||
					`${a.title} ${a.desc} ${a.company} ${a.owner}`
						.toLowerCase()
						.includes(q))
			);
		})
		.toSorted((a, b) =>
			mode === "completed"
				? b.date.localeCompare(a.date) || a.min - b.min
				: a.date.localeCompare(b.date) || a.min - b.min,
		);

	const todayActs = acts.filter((a) => scopeMatch(a, "today"));
	const todayDone = todayActs.filter((a) => a.done).length;
	const overdueCount = acts.filter((a) => scopeMatch(a, "overdue")).length;

	const firstDow = new Date(cal.y, cal.m, 1).getDay();
	const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();

	function heading(k: string) {
		const d = parseDateKey(k);
		const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
		return k === todayKey ? `Today, ${base}` : `${DAYS[d.getDay()]}, ${base}`;
	}

	function openModal() {
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
	}

	function onSave(form: HTMLFormElement) {
		const data = new FormData(form);
		const type = data.get("type") as ActivityTypeKey;
		const [h, m] = String(data.get("time")).split(":").map(Number);
		const date = String(data.get("date"));
		const item: ActivityItem = {
			id: nextId,
			type,
			title: String(data.get("title")),
			desc: String(data.get("desc") || ACTIVITY_TYPE_META[type].desc),
			company: String(data.get("company") || ""),
			owner: String(data.get("owner")),
			date,
			min: h * 60 + m,
			done: false,
		};
		setNextId((n) => n + 1);
		setActs((prev) => [...prev, item]);
		closeModal();
		pick(parseDateKey(date));
		toast("Activity added");
		form.reset();
	}

	let lastDate = "";

	return (
		<div className={styles.wrap}>
			<header className={styles.top}>
				<div className={styles.topText}>
					<h1 className={styles.display}>Activities</h1>
					<p>Manage your calls, meetings, emails and tasks in one place.</p>
				</div>
				<div className={styles.tools}>
					<div className={styles.pillCtl}>
						<label htmlFor={`${dateInputId}-view`}>View</label>
						<select
							id={`${dateInputId}-view`}
							value={vmode}
							onChange={(e) => {
								setVmode(e.target.value as ActivityViewMode);
								if (mode !== "date") setMode("date");
							}}
						>
							<option value="list">List</option>
							<option value="week">Week</option>
						</select>
					</div>
					<button
						type="button"
						className={styles.sq}
						title="Previous"
						onClick={() =>
							pick(addDays(sel, vmode === "week" ? -7 : -1))
						}
					>
						<Icon icon={ChevronLeft} />
					</button>
					<button
						type="button"
						className={`${styles.pillCtl} ${styles.dateBtn}`}
						onClick={() => {
							const el = dateInputRef.current;
							if (!el) return;
							try {
								el.showPicker();
							} catch {
								el.focus();
							}
						}}
					>
						<Icon icon={Calendar} />
						<span>
							{sel.getDate()} {MONTHS[sel.getMonth()].slice(0, 3)}{" "}
							{sel.getFullYear()}
						</span>
						<input
							ref={dateInputRef}
							id={dateInputId}
							type="date"
							value={dateKey(sel)}
							onChange={(e) => {
								if (e.target.value) pick(parseDateKey(e.target.value));
							}}
						/>
					</button>
					<button type="button" className={styles.add} onClick={openModal}>
						<Icon icon={Add} />
						Add Activities
					</button>
				</div>
			</header>

			<section className={styles.kpis}>
				<Kpi
					iconClass={styles.k1}
					icon={Calendar}
					n={todayActs.length}
					label="Today"
					delta={ACTIVITIES.kpiDeltas.today}
				/>
				<Kpi
					iconClass={styles.k2}
					icon={Checkmark}
					n={todayDone}
					label="Completed"
					delta={ACTIVITIES.kpiDeltas.completed}
				/>
				<Kpi
					iconClass={styles.k3}
					icon={Time}
					n={todayActs.length - todayDone}
					label="Pending"
					delta={ACTIVITIES.kpiDeltas.pending}
				/>
				<Kpi
					iconClass={styles.k4}
					icon={Calendar}
					n={overdueCount}
					label="Overdue"
					delta={ACTIVITIES.kpiDeltas.overdue}
				/>
			</section>

			<div className={styles.bar}>
				<nav className={styles.tabs}>
					{ACTIVITIES.tabs.map((t) => (
						<button
							key={t}
							type="button"
							className={`${styles.tab} ${tab === t ? styles.tabOn : ""}`}
							onClick={() => setTab(t)}
						>
							{TAB_LABELS[t]}
						</button>
					))}
				</nav>
				<div className={styles.filters}>
					<select
						className={styles.sel}
						value={filtType}
						onChange={(e) => setFiltType(e.target.value)}
					>
						<option value="">All Types</option>
						{ACTIVITIES.types.map((t) => (
							<option key={t} value={t}>
								{ACTIVITY_TYPE_META[t].label}s
							</option>
						))}
					</select>
					<select
						className={styles.sel}
						value={filtStatus}
						onChange={(e) => setFiltStatus(e.target.value)}
					>
						<option value="">All Statuses</option>
						<option value="pending">Pending</option>
						<option value="completed">Completed</option>
						<option value="overdue">Overdue</option>
					</select>
					<select
						className={styles.sel}
						value={filtOwner}
						onChange={(e) => setFiltOwner(e.target.value)}
					>
						<option value="">All Owners</option>
						{ACTIVITIES.owners.map((o) => (
							<option key={o} value={o}>
								{o}
							</option>
						))}
					</select>
					<label className={styles.search}>
						<Icon icon={Search} />
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search activities..."
						/>
					</label>
				</div>
			</div>

			<div className={styles.main}>
				<aside className={styles.side}>
					<div className={styles.cal}>
						<div className={styles.calH}>
							<h3 className={styles.display}>
								{MONTHS[cal.m]} {cal.y}
							</h3>
							<div className={styles.calNav}>
								<button
									type="button"
									aria-label="Previous month"
									onClick={() =>
										setCal((c) => {
											const m = c.m - 1;
											return m < 0
												? { y: c.y - 1, m: 11 }
												: { y: c.y, m };
										})
									}
								>
									<Icon icon={ChevronLeft} />
								</button>
								<button
									type="button"
									aria-label="Next month"
									onClick={() =>
										setCal((c) => {
											const m = c.m + 1;
											return m > 11
												? { y: c.y + 1, m: 0 }
												: { y: c.y, m };
										})
									}
								>
									<Icon icon={ChevronRight} />
								</button>
							</div>
						</div>
						<div className={styles.cgrid}>
							{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
								<div key={d} className={styles.wd}>
									{d}
								</div>
							))}
							{Array.from({ length: firstDow }, (_, i) => (
								<div key={`pad-${i}`} />
							))}
							{Array.from({ length: daysInMonth }, (_, i) => {
								const d = i + 1;
								const k = `${cal.y}-${String(cal.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const types = [
									...new Set(
										acts
											.filter((a) => a.date === k && enabled[a.type])
											.map((a) => a.type),
									),
								].slice(0, 3);
								return (
									<button
										key={k}
										type="button"
										className={`${styles.day} ${k === dateKey(sel) ? styles.daySel : ""} ${k === todayKey ? styles.dayToday : ""}`}
										onClick={() => pick(parseDateKey(k))}
									>
										<span>{d}</span>
										<div className={styles.dots}>
											{types.map((t) => (
												<i
													key={t}
													style={{ background: ACTIVITY_TYPE_META[t].dot }}
												/>
											))}
										</div>
									</button>
								);
							})}
						</div>
					</div>

					<h4>Quick Filters</h4>
					<div>
						{QUICK_META.map((item) => {
							const active =
								item.key === "today"
									? mode === "date" &&
										vmode === "list" &&
										dateKey(sel) === todayKey
									: mode === item.key;
							const count = acts.filter((a) =>
								scopeMatch(a, item.key),
							).length;
							return (
								<button
									key={item.key}
									type="button"
									className={`${styles.q} ${active ? styles.qOn : ""}`}
									onClick={() => {
										if (item.key === "today") {
											setVmode("list");
											pick(TODAY);
										} else {
											setMode(item.key);
										}
									}}
								>
									<Icon icon={item.icon} />
									{item.label}
									<em>{count}</em>
								</button>
							);
						})}
					</div>

					<h4>My Calendar</h4>
					<div>
						{(
							[
								["call", "Calls"],
								["meeting", "Meetings"],
								["email", "Emails"],
								["task", "Tasks"],
							] as const
						).map(([key, label]) => (
							<button
								key={key}
								type="button"
								className={`${styles.tg} ${enabled[key] ? styles.tgOn : ""}`}
								onClick={() =>
									setEnabled((prev) => ({ ...prev, [key]: !prev[key] }))
								}
							>
								<i
									className={styles.tgDot}
									style={{ background: ACTIVITY_TYPE_META[key].dot }}
								/>
								{label}
								<span className={styles.sw} />
							</button>
						))}
					</div>
				</aside>

				<section className={styles.list}>
					{visible.length === 0 ? (
						<div className={styles.empty}>
							No activities found for this selection.
						</div>
					) : (
						visible.flatMap((a) => {
							const showHeading = a.date !== lastDate;
							lastDate = a.date;
							const meta = ACTIVITY_TYPE_META[a.type];
							const status = activityStatus(a, todayKey);
							const d = parseDateKey(a.date);
							const nodes: ReactNode[] = [];
							if (showHeading) {
								nodes.push(
									<h3
										key={`h-${a.date}`}
										className={`${styles.gh} ${styles.display}`}
									>
										{heading(a.date)}
									</h3>,
								);
							}
							nodes.push(
								<div
									key={a.id}
									className={`${styles.row} ${a.done ? styles.rowDone : ""}`}
								>
									<time>{formatTime(a.min)}</time>
									<span
										className={styles.ric}
										style={{ background: meta.bg, color: meta.fg }}
									>
										<Icon icon={TYPE_ICON[a.type]} />
									</span>
									<div>
										<div className={styles.ttl}>{a.title}</div>
										<div className={styles.dsc}>{a.desc}</div>
									</div>
									<div className={styles.tags}>
										<span
											className={styles.tag}
											style={{ background: meta.bg, color: meta.fg }}
										>
											{meta.label}
										</span>
										{status !== "pending" ? (
											<span
												className={`${styles.tag} ${styles.tagS} ${status === "overdue" ? styles.tagOd : ""}`}
											>
												{status === "completed" ? (
													<>
														<Icon icon={Checkmark} className="size-2.5" />
														Done
													</>
												) : (
													"Overdue"
												)}
											</span>
										) : null}
									</div>
									<div className={styles.co}>
										<Icon icon={Building} />
										<span>{a.company || "—"}</span>
									</div>
									<div className={styles.own}>
										<span className={styles.av}>{initials(a.owner)}</span>
										<div>
											<b>{a.owner}</b>
											<small>
												{a.date === todayKey
													? "Today"
													: `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`}
											</small>
										</div>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className={styles.kb}
												aria-label="More"
											>
												⋮
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="min-w-40">
											<DropdownMenuItem
												onSelect={() => {
													if (typeof a.id === "string") {
														completeMutation.mutate({
															id: a.id,
															completed: !a.done,
														});
													}
													setActs((prev) =>
														prev.map((x) =>
															x.id === a.id ? { ...x, done: !x.done } : x,
														),
													);
													toast(
														a.done
															? "Marked as pending"
															: "Marked as completed",
													);
												}}
											>
												{a.done ? "Mark as pending" : "Mark as completed"}
											</DropdownMenuItem>
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => {
													setActs((prev) => prev.filter((x) => x.id !== a.id));
													toast("Activity deleted");
												}}
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>,
							);
							return nodes;
						})
					)}
				</section>
			</div>

			<div
				className={`${styles.modal} ${modalOpen ? styles.modalOpen : ""}`}
				onMouseDown={(e) => {
					if (e.target === e.currentTarget) closeModal();
				}}
			>
				<form
					key={modalOpen ? `open-${dateKey(sel)}` : "closed"}
					className={styles.dlg}
					onSubmit={(e) => {
						e.preventDefault();
						onSave(e.currentTarget);
					}}
					onKeyDown={(e) => {
						if (e.key === "Escape") closeModal();
					}}
				>
					<h2 className={styles.display}>Add Activity</h2>
					<label htmlFor={`${dateInputId}-title`}>Title</label>
					<input
						id={`${dateInputId}-title`}
						name="title"
						required
						placeholder="e.g. Call with Rahul Shah"
					/>
					<div className={styles.two}>
						<div>
							<label htmlFor={`${dateInputId}-type`}>Type</label>
							<select id={`${dateInputId}-type`} name="type" defaultValue="call">
								{ACTIVITIES.types.map((t) => (
									<option key={t} value={t}>
										{ACTIVITY_TYPE_META[t]?.label ?? t}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor={`${dateInputId}-owner`}>Owner</label>
							<select
								id={`${dateInputId}-owner`}
								name="owner"
								defaultValue={ACTIVITIES.owners[0]}
							>
								{ACTIVITIES.owners.map((o) => (
									<option key={o} value={o}>
										{o}
									</option>
								))}
							</select>
						</div>
					</div>
					<div className={styles.two}>
						<div>
							<label htmlFor={`${dateInputId}-date`}>Date</label>
							<input
								id={`${dateInputId}-date`}
								type="date"
								name="date"
								required
								defaultValue={dateKey(sel)}
							/>
						</div>
						<div>
							<label htmlFor={`${dateInputId}-time`}>Time</label>
							<input
								id={`${dateInputId}-time`}
								type="time"
								name="time"
								required
								defaultValue="10:30"
							/>
						</div>
					</div>
					<label htmlFor={`${dateInputId}-company`}>Company</label>
					<input
						id={`${dateInputId}-company`}
						name="company"
						placeholder="e.g. Acme Technologies"
					/>
					<label htmlFor={`${dateInputId}-desc`}>Description</label>
					<textarea
						id={`${dateInputId}-desc`}
						name="desc"
						rows={2}
						placeholder="Short note"
					/>
					<div className={styles.acts}>
						<button
							type="button"
							className={styles.btn}
							onClick={closeModal}
						>
							Cancel
						</button>
						<button type="submit" className={`${styles.btn} ${styles.btnP}`}>
							Save Activity
						</button>
					</div>
				</form>
			</div>

			<div className={`${styles.toast} ${toastOn ? styles.toastShow : ""}`}>
				{toastMsg}
			</div>
		</div>
	);
}

function Kpi({
	iconClass,
	icon,
	n,
	label,
	delta,
}: {
	iconClass: string;
	icon: CarbonIcon;
	n: number;
	label: string;
	delta: { dir: "up" | "dn" | "nu"; value: string };
}) {
	const chgClass =
		delta.dir === "up"
			? styles.chgUp
			: delta.dir === "dn"
				? styles.chgDn
				: styles.chgNu;
	return (
		<div className={styles.kpi}>
			<span className={`${styles.kic} ${iconClass}`}>
				<Icon icon={icon} />
			</span>
			<div className={styles.kt}>
				<b>{n}</b>
				<span>{label}</span>
			</div>
			<span className={`${styles.chg} ${chgClass}`}>
				{delta.dir === "up" ? <Icon icon={ArrowUp} /> : null}
				{delta.dir === "dn" ? <Icon icon={ArrowDown} /> : null}
				{delta.value}
			</span>
		</div>
	);
}
