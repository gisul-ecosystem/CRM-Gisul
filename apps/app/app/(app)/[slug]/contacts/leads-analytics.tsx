"use client";

import { useQuery } from "@tanstack/react-query";
import {
	LEAD_SOURCE_OPTIONS,
	LEAD_STATUS_OPTIONS,
} from "@/lib/lead-fields";
import { ProductMark } from "@/components/crm/product-mark";
import { useTRPC } from "@/lib/trpc/client";
import styles from "./leads-design.module.css";

const NO_PRODUCT = "none";
const NO_SOURCE = "none";

export function LeadsAnalytics({
	facetCounts,
}: {
	facetCounts: Record<string, Record<string, number>> | undefined;
}) {
	const trpc = useTRPC();
	const products = useQuery(trpc.products.options.queryOptions());
	const productOptions = products.data?.options ?? [];

	const statusRows = LEAD_STATUS_OPTIONS.map((row) => {
		const count = facetCounts?.leadStatus?.[row.value] ?? 0;
		return { ...row, count };
	});
	const statusTotal = statusRows.reduce((sum, row) => sum + row.count, 0);
	const statusGradient = conicGradient(statusRows, statusTotal);

	const sourceRows = [
		...LEAD_SOURCE_OPTIONS.map((row) => ({
			label: row.label,
			count: facetCounts?.leadSource?.[row.value] ?? 0,
		})),
		{
			label: "No source",
			count: facetCounts?.leadSource?.[NO_SOURCE] ?? 0,
		},
	].filter((row) => row.count > 0);
	const maxSource = Math.max(...sourceRows.map((row) => row.count), 1);

	const productCounts = facetCounts?.product ?? {};
	const knownProductIds = new Set(productOptions.map((product) => product.id));
	const productRows = [
		...productOptions
			.map((product) => ({
				id: product.id,
				name: product.name,
				color: product.color,
				iconUrl: product.iconUrl,
				count: productCounts[product.id] ?? 0,
			}))
			.filter((row) => row.count > 0),
		...Object.entries(productCounts)
			.filter(
				([id, count]) =>
					id !== NO_PRODUCT && !knownProductIds.has(id) && count > 0,
			)
			.map(([id, count]) => ({
				id,
				name: "Archived product",
				color: "#5a5a66",
				iconUrl: null,
				count,
			})),
		...(productCounts[NO_PRODUCT]
			? [
					{
						id: NO_PRODUCT,
						name: "No product",
						color: "#5a5a66",
						iconUrl: null,
						count: productCounts[NO_PRODUCT] ?? 0,
					},
				]
			: []),
	].toSorted((a, b) => b.count - a.count);
	const maxProduct = Math.max(...productRows.map((row) => row.count), 1);

	return (
		<section className={styles.analytics}>
			<div className={`${styles.card} ${styles.analytic}`}>
				<div className={styles.analyticTitle}>Leads by Status</div>
				<div className={styles.donutRow}>
					<div className={styles.donutWrap}>
						<div
							aria-hidden="true"
							style={{
								width: "100%",
								height: "100%",
								borderRadius: "50%",
								background: statusGradient,
								mask: "radial-gradient(circle, transparent 34px, #000 35px)",
								WebkitMask:
									"radial-gradient(circle, transparent 34px, #000 35px)",
							}}
						/>
						<div className={styles.donutCenter}>
							<b>{statusTotal}</b>
							<span>Leads</span>
						</div>
					</div>
					<div className={styles.legend}>
						{statusRows.map((row) => (
							<div key={row.value} className={styles.legendRow}>
								<span className={styles.dot} style={{ background: row.color }} />
								<span className={styles.legendLabel}>{row.label}</span>
								<span className={styles.legendCount}>{row.count}</span>
								<span className={styles.legendPct}>
									{percent(row.count, statusTotal)}%
								</span>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className={`${styles.card} ${styles.analytic}`}>
				<div className={styles.analyticTitle}>Leads by Source</div>
				{sourceRows.length === 0 ? (
					<p className={styles.note}>No source data yet.</p>
				) : (
					<div className={styles.bars}>
						{sourceRows.map((row) => (
							<div key={row.label} className={styles.barRow}>
								<span>{row.label}</span>
								<span className={styles.barTrack}>
									<span
										className={styles.barFill}
										style={{ width: `${(row.count / maxSource) * 100}%` }}
									/>
								</span>
								<span className={styles.barCount}>{row.count}</span>
							</div>
						))}
					</div>
				)}
			</div>

			<div className={`${styles.card} ${styles.analytic}`}>
				<div className={styles.analyticTitle}>Product Split</div>
				{productRows.length === 0 ? (
					<p className={styles.note}>No product data yet.</p>
				) : (
					<div className={styles.bars}>
						{productRows.map((row) => (
							<div key={row.id} className={styles.productRow}>
								<ProductMark
									name={row.name}
									color={row.color}
									iconUrl={row.iconUrl}
									className={styles.productIcon}
								/>
								<span className={styles.productBar}>
									<span
										className={styles.productFill}
										style={{
											width: `${(row.count / maxProduct) * 100}%`,
											background: row.color,
										}}
									/>
								</span>
								<span className={styles.barCount}>{row.count}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

function percent(count: number, total: number): number {
	if (total <= 0) return 0;
	return Math.round((count / total) * 100);
}

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
