"use client";

import { DEAL_STAGE_CATALOG } from "@crm/db/deal-stage";
import { formatMoneyCompact } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ProductMark } from "@/components/crm/product-mark";
import { useTRPC } from "@/lib/trpc/client";
import styles from "./deals-design.module.css";
import { STAGE_COLORS } from "./deals-dummy";

export function DealsAnalytics({
	facetCounts,
	total,
}: {
	facetCounts: Record<string, Record<string, number>> | undefined;
	total: number;
}) {
	const trpc = useTRPC();
	const trendQuery = useQuery(trpc.deals.trend.queryOptions());
	const pipelineQuery = useQuery(trpc.deals.pipelineByProduct.queryOptions());
	const [rangeMonths, setRangeMonths] = useState<TrendMonths>(6);
	const trend = (trendQuery.data?.points ?? []).slice(-rangeMonths);
	const pipelineProducts = pipelineQuery.data?.products ?? [];
	const reportingCurrency = pipelineQuery.data?.reportingCurrency ?? "usd";
	const maxPipeline = Math.max(
		...pipelineProducts.map((row) => row.pipelineCents),
		0,
	);

	const stageCounts = DEAL_STAGE_CATALOG.map((entry) => ({
		...entry,
		count: facetCounts?.stage?.[entry.stage] ?? 0,
		color: STAGE_COLORS[entry.stage],
	}));
	const stageTotal =
		stageCounts.reduce((sum, row) => sum + row.count, 0) || total;
	const gradient = conicGradient(stageCounts, stageTotal);
	const maxTrend = Math.max(...trend.map((point) => point.created), 0);
	const span = Math.max(trend.length - 1, 1);
	const points = trend
		.map((point, index) => {
			const x = (index / span) * 100;
			const y =
				maxTrend > 0 ? 100 - (point.created / maxTrend) * 80 - 10 : 90;
			return `${x},${y}`;
		})
		.join(" ");

	return (
		<section className={styles.analytics}>
			<div className={`${styles.card} ${styles.analytic}`}>
				<div className={styles.analyticTitle}>Deals by Stage</div>
				<div className={styles.donutRow}>
					<div className={styles.donutWrap}>
						<div
							aria-hidden="true"
							style={{
								width: "100%",
								height: "100%",
								borderRadius: "50%",
								background: gradient,
								mask: "radial-gradient(circle, transparent 34px, #000 35px)",
								WebkitMask:
									"radial-gradient(circle, transparent 34px, #000 35px)",
							}}
						/>
						<div className={styles.donutCenter}>
							<b>{stageTotal}</b>
							<span>Deals</span>
						</div>
					</div>
					<div className={styles.legend}>
						{stageCounts.map((row) => (
							<div key={row.stage} className={styles.legendRow}>
								<span className={styles.dot} style={{ background: row.color }} />
								<span className={styles.legendLabel}>{row.label}</span>
								<span className={styles.legendCount}>{row.count}</span>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className={`${styles.card} ${styles.analytic}`}>
				<div className={styles.analyticTitle}>Pipeline by Product</div>
				{pipelineProducts.length === 0 ? (
					<p className={styles.note}>No products yet.</p>
				) : (
					<div className={styles.bars}>
						{pipelineProducts.map((row) => {
							const pct =
								maxPipeline > 0
									? Math.max(
											row.pipelineCents > 0 ? 4 : 0,
											Math.round((row.pipelineCents / maxPipeline) * 100),
										)
									: 0;
							return (
								<div key={row.id ?? "none"} className={styles.barRow}>
									<ProductMark
										name={row.name}
										color={row.color}
										iconUrl={row.iconUrl}
										className={styles.productIcon}
									/>
									<span className={styles.barTrack}>
										<span
											className={styles.barFill}
											style={{ width: `${pct}%`, background: row.color }}
										/>
									</span>
									<span className={styles.barValue}>
										{formatMoneyCompact(row.pipelineCents, reportingCurrency)}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</div>

			<div className={`${styles.card} ${styles.analytic}`}>
				<div className={styles.trendHead}>
					<div className={styles.analyticTitle}>Deal Trend</div>
					<select
						className={styles.sel}
						aria-label="Trend range"
						value={rangeMonths}
						onChange={(event) =>
							setRangeMonths(Number(event.target.value) as TrendMonths)
						}
					>
						{TREND_RANGES.map((option) => (
							<option key={option.months} value={option.months}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<div className={styles.trendChart}>
					{trend.length > 0 ? (
						<svg
							className={styles.trendSvg}
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<polyline
								fill="none"
								stroke="#5b3f9e"
								strokeWidth="2"
								points={points}
								vectorEffect="non-scaling-stroke"
							/>
							{trend.map((point, index) => {
								const x = (index / span) * 100;
								const y =
									maxTrend > 0
										? 100 - (point.created / maxTrend) * 80 - 10
										: 90;
								return (
									<circle
										key={point.yearMonth}
										cx={x}
										cy={y}
										r="1.8"
										fill="#5b3f9e"
									>
										<title>
											{point.month}: {point.created} created, {point.won} won
										</title>
									</circle>
								);
							})}
						</svg>
					) : null}
				</div>
				<div className={styles.trendLabels}>
					{trend.map((point) => (
						<span key={point.yearMonth}>{point.month}</span>
					))}
				</div>
			</div>
		</section>
	);
}

const TREND_RANGES = [
	{ months: 3, label: "Last 3 months" },
	{ months: 6, label: "Last 6 months" },
	{ months: 12, label: "Last 12 months" },
] as const;

type TrendMonths = (typeof TREND_RANGES)[number]["months"];

function conicGradient(
	rows: ReadonlyArray<{ color: string; count: number }>,
	total: number,
): string {
	if (total <= 0) return "#eceef5";
	let start = 0;
	const parts = rows.map((row) => {
		const slice = Math.max(row.count, 0);
		const end = start + (slice / total) * 360;
		const part = `${row.color} ${start}deg ${end}deg`;
		start = end;
		return part;
	});
	if (start < 360) parts.push(`#eceef5 ${start}deg 360deg`);
	return `conic-gradient(${parts.join(", ")})`;
}
