"use client";

import Building from "@carbon/icons-react/es/Building";
import Calendar from "@carbon/icons-react/es/Calendar";
import Currency from "@carbon/icons-react/es/Currency";
import Document from "@carbon/icons-react/es/Document";
import Download from "@carbon/icons-react/es/Download";
import User from "@carbon/icons-react/es/User";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { formatDay, formatMoney, formatMoneyCompact } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { leadSourceLabel } from "@/lib/lead-fields";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	niceStep,
	REPORTS,
	type ReportRange,
	type ReportTab,
	type ReportTrendMode,
} from "./reports-config";
import styles from "./reports-design.module.css";

type ReportData = RouterOutputs["dashboard"]["report"];

const TAB_LABELS: Record<ReportTab, string> = {
	overview: "Overview",
	leads: "Leads",
	deals: "Deals",
	activities: "Activities",
};

const RANGE_FALLBACK: Record<ReportRange, string> = {
	m: "This month",
	lm: "Last month",
	q: "This quarter",
	y: "This year",
};

export function ReportsPageClient() {
	const trpc = useTRPC();
	const gid = useId().replace(/:/g, "");
	const [tab, setTab] = useState<ReportTab>("overview");
	const [range, setRange] = useState<ReportRange>("m");
	const [productId, setProductId] = useState("");
	const [ownerId, setOwnerId] = useState("");
	const [trendGrain, setTrendGrain] = useState<ReportTrendMode>("monthly");
	const [stageProductId, setStageProductId] = useState("");
	const [showAllDeals, setShowAllDeals] = useState(false);
	const [tip, setTip] = useState<{
		host: "trend" | "stage";
		content: ReactNode;
		x: number;
		y: number;
	} | null>(null);
	const [donutHover, setDonutHover] = useState<number | null>(null);

	const reportQuery = useQuery(
		trpc.dashboard.report.queryOptions({
			range,
			productId: productId || undefined,
			ownerId: ownerId || undefined,
			stageProductId: stageProductId || undefined,
			trendGrain,
		}),
	);

	const data = reportQuery.data;
	const showKpis = tab !== "activities";
	const showTrend = tab === "overview" || tab === "leads";
	const showStage = tab === "overview" || tab === "deals";
	const showSource = tab === "overview" || tab === "leads";
	const showDeals = tab === "overview" || tab === "deals";
	const showActs = tab === "activities";

	if (reportQuery.isPending && !data) {
		return (
			<div className={styles.wrap}>
				<div className={styles.none}>
					<Spinner />
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className={styles.wrap}>
				<div className={styles.none}>Could not load report data.</div>
			</div>
		);
	}

	const currency = data.reportingCurrency;
	const sourceRows = data.leadSources.map((row, index) => ({
		label: row.source ? leadSourceLabel(row.source) : "No source",
		count: row.count,
		color: REPORTS.sourceColors[index % REPORTS.sourceColors.length],
	}));
	const sourceTotal = sourceRows.reduce((sum, row) => sum + row.count, 0) || 1;
	const dealRows = showAllDeals
		? data.recentDeals
		: data.recentDeals.slice(0, REPORTS.recentPreview);
	const actMax = Math.max(...data.activitiesByType.map((row) => row.count), 1);

	function exportCsv(report: ReportData) {
		const rows: (string | number)[][] = [
			["Report", report.range.label],
			[
				"Product",
				productId
					? (report.products.find((p) => p.id === productId)?.name ?? productId)
					: "All Products",
			],
			[
				"Owner",
				ownerId
					? (report.owners.find((o) => o.id === ownerId)?.name ?? ownerId)
					: "All Owners",
			],
			[],
			["New Leads", report.kpis.newLeads.value],
			["New Customers", report.kpis.newCustomers.value],
			["Deals Won", report.kpis.dealsWon.value],
			["Revenue (cents)", report.kpis.revenueCents.value],
			[],
			[`Leads trend (${trendGrain})`],
			...report.leadsTrend.map((point) => [point.label, point.count]),
			[],
			["Deals by stage"],
			...report.dealsByStage.map((stage) => [
				stage.label,
				stage.count,
				stage.valueCents,
			]),
			[],
			["Leads by source"],
			...report.leadSources.map((row) => [
				row.source ? leadSourceLabel(row.source) : "No source",
				row.count,
			]),
			[],
			["Deal", "Company", "ValueCents", "Stage", "Expected Close"],
			...report.recentDeals.map((deal) => [
				deal.name,
				deal.companyName,
				deal.valueCents ?? "",
				deal.stageLabel,
				deal.expectedCloseDate ? formatDay(deal.expectedCloseDate) : "",
			]),
			[],
			["Activities by type"],
			...report.activitiesByType.map((row) => [row.label, row.count]),
		];
		const csv = rows
			.map((row) =>
				row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
			)
			.join("\n");
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
		a.download = "report.csv";
		a.click();
		URL.revokeObjectURL(a.href);
	}

	return (
		<div className={styles.wrap}>
			<header className={styles.top}>
				<div className={styles.topText}>
					<h1 className={styles.display}>Reports</h1>
					<p>Track your sales performance and team activity.</p>
				</div>
				<div className={styles.ctl}>
					<span className={`${styles.sw} ${styles.swDate}`}>
						<span className={styles.swIcon}>
							<Icon icon={Calendar} />
						</span>
						<select
							className={styles.sel}
							value={range}
							onChange={(e) => setRange(e.target.value as ReportRange)}
						>
							{REPORTS.ranges.map((key) => (
								<option key={key} value={key}>
									{key === range
										? `${RANGE_FALLBACK[key]} (${data.range.label})`
										: RANGE_FALLBACK[key]}
								</option>
							))}
						</select>
					</span>
					<span className={styles.sw}>
						<select
							className={styles.sel}
							value={productId}
							onChange={(e) => {
								const next = e.target.value;
								setProductId(next);
								setStageProductId(next);
							}}
						>
							<option value="">All Products</option>
							{data.products.map((product) => (
								<option key={product.id} value={product.id}>
									{product.name}
								</option>
							))}
						</select>
					</span>
					<span className={styles.sw}>
						<select
							className={styles.sel}
							value={ownerId}
							onChange={(e) => setOwnerId(e.target.value)}
						>
							<option value="">All Owners</option>
							{data.owners.map((owner) => (
								<option key={owner.id} value={owner.id}>
									{owner.name}
								</option>
							))}
						</select>
					</span>
					<button
						type="button"
						className={styles.export}
						onClick={() => exportCsv(data)}
					>
						<Icon icon={Download} />
						Export
					</button>
				</div>
			</header>

			<nav className={styles.tabs}>
				{REPORTS.tabs.map((key) => (
					<button
						key={key}
						type="button"
						className={`${styles.tab} ${tab === key ? styles.tabOn : ""}`}
						onClick={() => setTab(key)}
					>
						{TAB_LABELS[key]}
					</button>
				))}
			</nav>

			{showKpis ? (
				<section className={styles.kpis}>
					<Kpi
						icon={User}
						bg="#ece9fb"
						fg="#4a3fb0"
						n={String(data.kpis.newLeads.value)}
						label="New Leads"
						delta={data.kpis.newLeads.deltaPercent}
					/>
					<Kpi
						icon={Building}
						bg="#fff1dc"
						fg="#e0891a"
						sq
						n={String(data.kpis.newCustomers.value)}
						label="New Customers"
						delta={data.kpis.newCustomers.deltaPercent}
					/>
					<Kpi
						icon={Currency}
						bg="#f1eafd"
						fg="#7a4fd0"
						sq
						n={String(data.kpis.dealsWon.value)}
						label="Deals Won"
						delta={data.kpis.dealsWon.deltaPercent}
					/>
					<Kpi
						icon={Document}
						bg="#fff6d0"
						fg="#e8b100"
						sq
						n={formatMoneyCompact(data.kpis.revenueCents.value, currency)}
						label="Revenue"
						delta={data.kpis.revenueCents.deltaPercent}
					/>
				</section>
			) : null}

			{showTrend || showStage ? (
				<div className={styles.rowf}>
					{showTrend ? (
						<section className={styles.card}>
							<div className={styles.hd}>
								<div>
									<h2 className={styles.display}>Leads Trend</h2>
									<p>New leads added over time.</p>
								</div>
								<span className={`${styles.sw} ${styles.swSm}`}>
									<select
										className={styles.sel}
										value={trendGrain}
										onChange={(e) =>
											setTrendGrain(e.target.value as ReportTrendMode)
										}
									>
										<option value="monthly">Monthly</option>
										<option value="weekly">Weekly</option>
										<option value="quarterly">Quarterly</option>
									</select>
								</span>
							</div>
							<div className={styles.chart}>
								{data.leadsTrend.length === 0 ? (
									<div className={styles.none}>No leads in this period.</div>
								) : (
									<>
										<TrendChart
											data={data.leadsTrend.map(
												(point) =>
													[point.label, point.count] as [string, number],
											)}
											gradId={`ga-${gid}`}
											onTip={(next) =>
												setTip(next ? { host: "trend", ...next } : null)
											}
										/>
										{tip?.host === "trend" ? (
											<div
												className={`${styles.tip} ${styles.tipOn}`}
												style={{ left: tip.x, top: tip.y }}
											>
												{tip.content}
											</div>
										) : null}
									</>
								)}
							</div>
						</section>
					) : null}

					{showStage ? (
						<section className={styles.card}>
							<div className={styles.hd}>
								<div>
									<h2 className={styles.display}>Deals by Stage</h2>
									<p>Current pipeline distribution.</p>
								</div>
								<span className={`${styles.sw} ${styles.swSm}`}>
									<select
										className={styles.sel}
										value={stageProductId}
										onChange={(e) => setStageProductId(e.target.value)}
									>
										<option value="">All Products</option>
										{data.products.map((product) => (
											<option key={product.id} value={product.id}>
												{product.name}
											</option>
										))}
									</select>
								</span>
							</div>
							<div className={styles.chart}>
								<StageChart
									data={data.dealsByStage.map((stage, index) => [
										stage.label,
										stage.count,
										REPORTS.stageColors[index % REPORTS.stageColors.length],
									])}
									onTip={(next) =>
										setTip(next ? { host: "stage", ...next } : null)
									}
								/>
								{tip?.host === "stage" ? (
									<div
										className={`${styles.tip} ${styles.tipOn}`}
										style={{ left: tip.x, top: tip.y }}
									>
										{tip.content}
									</div>
								) : null}
							</div>
						</section>
					) : null}
				</div>
			) : null}

			{showSource || showDeals ? (
				<div className={styles.rowf}>
					{showSource ? (
						<section className={`${styles.card} ${styles.src}`}>
							<div className={styles.hd}>
								<div>
									<h2 className={styles.display}>Leads by Source</h2>
									<p>Where your leads are coming from.</p>
								</div>
							</div>
							{sourceRows.every((row) => row.count === 0) ? (
								<div className={styles.none}>No lead sources yet.</div>
							) : (
								<div className={styles.dn}>
									<svg viewBox="0 0 150 150" aria-label="Leads by source">
										<title>Leads by source</title>
										<circle
											cx="75"
											cy="75"
											r="52"
											fill="none"
											stroke="#f1f0f7"
											strokeWidth="24"
										/>
										{(() => {
											const r = 52;
											const C = 2 * Math.PI * r;
											let acc = 0;
											return sourceRows.map((row, i) => {
												const len = (row.count / sourceTotal) * C;
												const dash = Math.max(len - 1.6, 0);
												const offset = -acc;
												acc += len;
												return (
													<circle
														key={row.label}
														className={styles.seg}
														cx="75"
														cy="75"
														r={r}
														fill="none"
														stroke={row.color}
														strokeWidth="24"
														strokeDasharray={`${dash} ${C}`}
														strokeDashoffset={offset}
														transform="rotate(-90 75 75)"
														onMouseEnter={() => setDonutHover(i)}
														onMouseLeave={() => setDonutHover(null)}
													/>
												);
											});
										})()}
										{donutHover === null ? (
											<>
												<text
													x="75"
													y="76"
													textAnchor="middle"
													style={{ font: "600 14px Poppins, sans-serif" }}
												>
													{sourceRows.reduce((sum, row) => sum + row.count, 0)}
												</text>
												<text
													x="75"
													y="88"
													textAnchor="middle"
													style={{
														font: "400 8.5px Poppins, sans-serif",
														fill: "#7a7890",
													}}
												>
													Leads
												</text>
											</>
										) : (
											<>
												<text
													x="75"
													y="73"
													textAnchor="middle"
													style={{ font: "600 14px Poppins, sans-serif" }}
												>
													{sourceRows[donutHover].count}
												</text>
												<text
													x="75"
													y="88"
													textAnchor="middle"
													style={{
														font: "400 8.5px Poppins, sans-serif",
														fill: "#7a7890",
													}}
												>
													{sourceRows[donutHover].label}
												</text>
											</>
										)}
									</svg>
									<div className={styles.lg}>
										{sourceRows.map((row) => (
											<div key={row.label} className={styles.lgRow}>
												<i
													className={styles.lgDot}
													style={{ background: row.color }}
												/>
												<span>{row.label}</span>
												<b>{row.count}</b>
												<em>
													{Math.round((row.count / sourceTotal) * 100)}%
												</em>
											</div>
										))}
									</div>
								</div>
							)}
						</section>
					) : null}

					{showDeals ? (
						<section className={`${styles.card} ${styles.rd}`}>
							<div className={styles.hd}>
								<div>
									<h2 className={styles.display}>Recent Deals</h2>
									<p>Recently created or updated deals.</p>
								</div>
								{data.recentDeals.length > REPORTS.recentPreview ? (
									<button
										type="button"
										className={styles.link}
										onClick={() => setShowAllDeals((value) => !value)}
									>
										{showAllDeals ? "Show less" : "View All"}
									</button>
								) : null}
							</div>
							<div className={styles.tbl}>
								<div className={`${styles.tr} ${styles.th}`}>
									<span>Deal Name</span>
									<span>Company</span>
									<span>Value</span>
									<span>Stage</span>
									<span>Expected Close</span>
								</div>
								{dealRows.length === 0 ? (
									<div className={styles.none}>
										No deals match these filters.
									</div>
								) : (
									dealRows.map((deal) => (
										<div key={deal.id} className={styles.tr}>
											<b>{deal.name}</b>
											<span className={styles.mutedCell}>
												{deal.companyName}
											</span>
											<b>
												{deal.valueCents === null
													? "—"
													: formatMoney(deal.valueCents, currency)}
											</b>
											<span
												className={`${styles.st} ${stageToneClass(deal.stageLabel)}`}
											>
												{deal.stageLabel}
											</span>
											<span className={styles.mutedCell}>
												{deal.expectedCloseDate
													? formatDay(deal.expectedCloseDate)
													: "—"}
											</span>
										</div>
									))
								)}
							</div>
						</section>
					) : null}
				</div>
			) : null}

			{showActs ? (
				<div className={styles.rowf}>
					<section className={styles.card}>
						<div className={styles.hd}>
							<div>
								<h2 className={styles.display}>Activities by Type</h2>
								<p>
									Calls, meetings, emails and tasks logged in the selected
									period.
								</p>
							</div>
						</div>
						<div className={styles.hb}>
							{data.activitiesByType.map((row) => (
								<div key={row.type} className={styles.hbRow}>
									<span>{row.label}</span>
									<span className={styles.track}>
										<i
											className={styles.trackFill}
											style={{ width: `${(row.count / actMax) * 100}%` }}
										/>
									</span>
									<b>{row.count}</b>
								</div>
							))}
						</div>
					</section>
				</div>
			) : null}
		</div>
	);
}

function stageToneClass(label: string) {
	const key = label.split(" ")[0]?.toLowerCase() ?? "";
	if (key.includes("negot")) return styles.stNegotiation;
	if (key.includes("propos") || key.includes("contract"))
		return styles.stProposal;
	if (key.includes("decision") || key.includes("needs")) return styles.stNeeds;
	return styles.stQualification;
}

function Kpi({
	icon,
	bg,
	fg,
	sq = false,
	n,
	label,
	delta,
}: {
	icon: CarbonIcon;
	bg: string;
	fg: string;
	sq?: boolean;
	n: string;
	label: string;
	delta: number | null;
}) {
	const chgClass =
		delta === null
			? styles.chgNu
			: delta < 0
				? styles.chgDn
				: styles.chg;
	const arrow = delta === null ? "" : delta < 0 ? "↓" : "↑";
	const text = delta === null ? "—" : `${Math.abs(delta)}%`;
	return (
		<div className={`${styles.card} ${styles.kpi}`}>
			<span
				className={`${styles.kic} ${sq ? styles.kicSq : ""}`}
				style={{ background: bg, color: fg }}
			>
				<Icon icon={icon} />
			</span>
			<div className={styles.kt}>
				<b>{n}</b>
				<span>{label}</span>
			</div>
			<div className={styles.kr}>
				<span className={`${styles.chg} ${chgClass}`}>
					{arrow} {text}
				</span>
				<small>vs prior period</small>
			</div>
		</div>
	);
}

function TrendChart({
	data,
	gradId,
	onTip,
}: {
	data: [string, number][];
	gradId: string;
	onTip: (tip: { content: ReactNode; x: number; y: number } | null) => void;
}) {
	const W = 480;
	const H = 230;
	const L = 40;
	const R = 472;
	const T = 14;
	const B = 185;
	const n = data.length;
	const step = niceStep(Math.max(...data.map((d) => d[1]), 1) / 4);
	const top = step * 4;
	const X = (i: number) =>
		n === 1 ? (L + R) / 2 : L + 14 + (i * (R - L - 28)) / Math.max(n - 1, 1);
	const Y = (v: number) => B - (v / top) * (B - T);
	const pts = data.map((d, i) => `${X(i)},${Y(d[1])}`).join(" ");

	return (
		<svg
			viewBox={`0 0 ${W} ${H}`}
			aria-label="Leads trend"
			onMouseMove={(e) => {
				const svg = e.currentTarget;
				const r = svg.getBoundingClientRect();
				const sx = ((e.clientX - r.left) * W) / r.width;
				let best = 0;
				data.forEach((_, i) => {
					if (Math.abs(X(i) - sx) < Math.abs(X(best) - sx)) best = i;
				});
				onTip({
					content: (
						<>
							{data[best][0]}: <b>{data[best][1]}</b> leads
						</>
					),
					x: (X(best) * r.width) / W,
					y: (Y(data[best][1]) * r.height) / H - 4,
				});
			}}
			onMouseLeave={() => onTip(null)}
		>
			<title>Leads trend</title>
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#6b52c9" stopOpacity="0.22" />
					<stop offset="1" stopColor="#6b52c9" stopOpacity="0" />
				</linearGradient>
			</defs>
			{Array.from({ length: 5 }, (_, k) => (
				<g key={k}>
					<line
						x1={L}
						x2={R}
						y1={Y(k * step)}
						y2={Y(k * step)}
						stroke="#eeedf4"
					/>
					<text
						className={styles.ax}
						x={L - 8}
						y={Y(k * step) + 3}
						textAnchor="end"
					>
						{k * step}
					</text>
				</g>
			))}
			<polygon
				points={`${X(0)},${B} ${pts} ${X(n - 1)},${B}`}
				fill={`url(#${gradId})`}
			/>
			<polyline
				points={pts}
				fill="none"
				stroke="#6b52a8"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			{data.map(([label, value], i) => (
				<g key={label}>
					<circle
						cx={X(i)}
						cy={Y(value)}
						r="3.3"
						fill="#d9d2f4"
						stroke="#6b52a8"
						strokeWidth="1.5"
					/>
					<text className={styles.ax} x={X(i)} y={B + 22} textAnchor="middle">
						{label}
					</text>
				</g>
			))}
		</svg>
	);
}

function StageChart({
	data,
	onTip,
}: {
	data: [string, number, string][];
	onTip: (tip: { content: ReactNode; x: number; y: number } | null) => void;
}) {
	const W = 480;
	const H = 235;
	const L = 36;
	const R = 472;
	const T = 22;
	const B = 190;
	const n = Math.max(data.length, 1);
	const slot = (R - L) / n;
	const step = niceStep(Math.max(...data.map((d) => d[1]), 1) / 3);
	const top = step * 3;
	const Y = (v: number) => B - (v / top) * (B - T);
	const total = data.reduce((s, d) => s + d[1], 0) || 1;

	return (
		<svg viewBox={`0 0 ${W} ${H}`} aria-label="Deals by stage">
			<title>Deals by stage</title>
			{Array.from({ length: 4 }, (_, k) => (
				<g key={k}>
					<line
						x1={L}
						x2={R}
						y1={Y(k * step)}
						y2={Y(k * step)}
						stroke="#eeedf4"
					/>
					<text
						className={styles.ax}
						x={L - 8}
						y={Y(k * step) + 3}
						textAnchor="end"
						style={{ fontSize: 8.5 }}
					>
						{k * step}
					</text>
				</g>
			))}
			{data.map(([label, value, color], i) => {
				const cx = L + slot * (i + 0.5);
				const w = Math.min(54, slot - 8);
				const words = label.split(" ");
				return (
					<g key={label}>
						<rect
							className={styles.bar}
							x={cx - w / 2}
							y={Y(value)}
							width={w}
							height={Math.max(B - Y(value), 0)}
							rx="1.5"
							fill={color}
							onMouseMove={(e) => {
								const svg = e.currentTarget.ownerSVGElement;
								if (!svg) return;
								const r = svg.getBoundingClientRect();
								const bb = e.currentTarget.getBoundingClientRect();
								onTip({
									content: (
										<>
											{label}: <b>{value}</b> deals (
											{Math.round((value / total) * 100)}%)
										</>
									),
									x: bb.left - r.left + bb.width / 2,
									y: bb.top - r.top - 18,
								});
							}}
							onMouseLeave={() => onTip(null)}
						/>
						<text
							className={styles.bv}
							x={cx}
							y={Y(value) - 7}
							textAnchor="middle"
						>
							{value}
						</text>
						{words.length === 2 ? (
							<>
								<text
									className={styles.ax}
									x={cx}
									y={B + 20}
									textAnchor="middle"
									style={{ fontSize: 10.5 }}
								>
									{words[0]}
								</text>
								<text
									className={styles.ax}
									x={cx}
									y={B + 33}
									textAnchor="middle"
									style={{ fontSize: 10.5 }}
								>
									{words[1]}
								</text>
							</>
						) : (
							<text
								className={styles.ax}
								x={cx}
								y={B + 28}
								textAnchor="middle"
								style={{ fontSize: 10.5 }}
							>
								{label}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
}
