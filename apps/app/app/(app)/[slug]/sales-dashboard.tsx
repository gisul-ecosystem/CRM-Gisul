"use client";

import ChartRadial from "@carbon/icons-react/es/ChartRadial";
import Folder from "@carbon/icons-react/es/Folder";
import Trophy from "@carbon/icons-react/es/Trophy";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import { Icon } from "@crm/ui/components/icon";
import {
	formatCount,
	formatMoneyCompact,
	formatPercent,
} from "@crm/ui/lib/format";
import Link from "next/link";
import { DealStage } from "@crm/db/enums";
import { dealStageLabel } from "@/lib/deal-stage";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import styles from "./dashboard-design.module.css";

type Summary = RouterOutputs["dashboard"]["summary"];

const STAGE_CLASS = [styles.s1, styles.s2, styles.s3, styles.s4] as const;

export function SalesDashboard({ summary }: { summary: Summary }) {
	const workspaceUrl = useWorkspaceUrl();
	const {
		leads,
		pipeline,
		wonThisMonth,
		wonPrevMonth,
		performance,
		reportingCurrency,
	} = summary;
	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);

	return (
		<>
			<section className={styles.kpis}>
				<div className={`${styles.card} ${styles.kpi}`}>
					<div className={styles.kpiRow}>
						<span className={styles.kpiIcon}>
							<Icon icon={UserMultiple} />
						</span>
					</div>
					<div className={styles.kpiLabel} style={{ marginTop: 2 }}>
						Total Leads
					</div>
					<div className={styles.kpiNum}>{leads.total}</div>
					<div className={styles.kpiSub}>
						<CountDelta
							current={leads.createdThisMonth}
							previous={leads.createdPrevMonth}
						/>{" "}
						vs last month
					</div>
				</div>

				<div className={`${styles.card} ${styles.kpi}`}>
					<div className={styles.kpiRow}>
						<span className={styles.kpiIcon}>
							<Icon icon={Folder} />
						</span>
						<span className={styles.kpiLabel}>Open Deals</span>
					</div>
					<div className={styles.kpiNum}>{pipeline.totalDeals}</div>
					<div className={styles.kpiSub}>
						<span className={styles.kpiSubBold}>{money(pipeline.totalCents)}</span>{" "}
						pipeline value
					</div>
				</div>

				<div className={`${styles.card} ${styles.kpi}`}>
					<div className={styles.kpiRow}>
						<span className={styles.kpiIcon}>
							<Icon icon={Trophy} />
						</span>
						<span className={styles.kpiLabel}>Deals Won</span>
					</div>
					<div className={styles.kpiNum}>{wonThisMonth.count}</div>
					<div className={styles.kpiSub}>
						<CountDelta
							current={wonThisMonth.count}
							previous={wonPrevMonth.count}
						/>{" "}
						vs last month
					</div>
				</div>

				<div className={`${styles.card} ${styles.kpi}`}>
					<div className={styles.kpiRow}>
						<span className={styles.kpiIcon}>
							<Icon icon={ChartRadial} />
						</span>
						<span className={styles.kpiLabel}>Conversion Rate</span>
					</div>
					<div className={styles.kpiNum}>
						{performance.winRateThisMonth === null
							? "—"
							: formatPercent(performance.winRateThisMonth)}
					</div>
					<div className={styles.kpiSub}>
						<RateDelta
							current={performance.winRateThisMonth}
							previous={performance.winRatePrevMonth}
						/>{" "}
						vs last month
					</div>
				</div>
			</section>

			<section className={`${styles.card} ${styles.pipe}`}>
				<div className={styles.head}>
					<div>
						<h2 className={styles.headTitle}>Sales Pipeline</h2>
						<p className={styles.headSub}>
							{money(pipeline.totalCents)} total pipeline across{" "}
							{formatCount(pipeline.totalDeals, "deal")}
						</p>
					</div>
					<Link href={workspaceUrl("/deals")} className={styles.link}>
						View Deals <Icon icon={ArrowRight} />
					</Link>
				</div>
				<div className={styles.stages}>
					{pipeline.stages.map((stage, index) => (
						<Link
							key={stage.stage}
							href={`${workspaceUrl("/deals")}?stage=${stage.stage}`}
							className={`${styles.stage} ${STAGE_CLASS[index] ?? styles.s1}`}
						>
							<span className={styles.stageName}>
								{dealStageLabel(stage.stage)}
							</span>
							<span className={styles.stageCount}>
								{formatCount(stage.count, "deal")}
							</span>
							<span className={styles.stageValue}>
								{money(stage.valueCents)}
							</span>
						</Link>
					))}
					<div className={`${styles.stage} ${styles.s5}`}>
						<span className={styles.stageName}>
							{dealStageLabel(DealStage.CLOSED_WON)}
						</span>
						<span className={styles.stageCount}>
							{formatCount(wonThisMonth.count, "deal")}
						</span>
						<span className={styles.stageValue}>
							{money(wonThisMonth.valueCents)}
						</span>
					</div>
				</div>
			</section>
		</>
	);
}

function CountDelta({
	current,
	previous,
}: {
	current: number;
	previous: number;
}) {
	if (previous === 0 && current === 0) {
		return <span className={styles.kpiFlat}>—</span>;
	}
	if (previous === 0) {
		return <span className={styles.up}>↑ +{current}</span>;
	}
	const change = Math.round(((current - previous) / previous) * 100);
	if (change === 0) {
		return <span className={styles.kpiFlat}>→ 0%</span>;
	}
	if (change > 0) {
		return <span className={styles.up}>↑ +{change}%</span>;
	}
	return <span className={styles.down}>↓ {Math.abs(change)}%</span>;
}

function RateDelta({
	current,
	previous,
}: {
	current: number | null;
	previous: number | null;
}) {
	if (current === null || previous === null) {
		return <span className={styles.kpiFlat}>—</span>;
	}
	const delta = current - previous;
	if (Math.abs(delta) < 0.0005) {
		return <span className={styles.kpiFlat}>→ 0%</span>;
	}
	if (delta > 0) {
		return <span className={styles.up}>↑ +{formatPercent(delta)}</span>;
	}
	return <span className={styles.down}>↓ {formatPercent(Math.abs(delta))}</span>;
}
