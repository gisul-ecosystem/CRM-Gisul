"use client";

import Calendar from "@carbon/icons-react/es/Calendar";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import User from "@carbon/icons-react/es/User";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import { useQueryState } from "nuqs";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import styles from "./dashboard-design.module.css";
import {
	listYearMonthKeys,
	monthRangeLabel,
	monthTitle,
	yearMonthKey,
} from "./overview-month";
import {
	OVERVIEW_SCOPES,
	type OverviewScope,
	overviewParsers,
} from "./overview-search-params";

const SCOPE_META = {
	me: { label: "Me", icon: User },
	everyone: { label: "Everyone", icon: UserMultiple },
} satisfies Record<OverviewScope, { label: string; icon: CarbonIcon }>;

export function OverviewScopeToggleFallback() {
	const currentKey = yearMonthKey();
	return (
		<div className={styles.topControls}>
			<ScopeSwitch value="everyone" disabled />
			<MonthRangeChip currentKey={currentKey} monthKey={currentKey} />
		</div>
	);
}

export function OverviewScopeToggle() {
	const currentKey = yearMonthKey();
	const [scope, setScope] = useQueryState(
		SEARCH_PARAM.overview.scope,
		overviewParsers[SEARCH_PARAM.overview.scope],
	);
	const [month, setMonth] = useQueryState(
		SEARCH_PARAM.overview.month,
		overviewParsers[SEARCH_PARAM.overview.month],
	);
	const monthKey = month ?? currentKey;
	const options = listYearMonthKeys();

	return (
		<div className={styles.topControls}>
			<ScopeSwitch
				value={scope}
				onChange={(next) => {
					void setScope(next);
				}}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={styles.range}
						aria-label={`${monthTitle(monthKey, currentKey)}, ${monthRangeLabel(monthKey)}`}
					>
						<span className={styles.rangeLeft}>
							<Icon icon={Calendar} className="text-[12px] text-[#7a7890]" />
							<span>
								<b suppressHydrationWarning>
									{monthTitle(monthKey, currentKey)}
								</b>
								<small suppressHydrationWarning>
									{monthRangeLabel(monthKey)}
								</small>
							</span>
						</span>
						<Icon icon={ChevronRight} className="text-[11px] text-[#a5a3b5]" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-48">
					<DropdownMenuRadioGroup
						value={monthKey}
						onValueChange={(next) => {
							void setMonth(next === currentKey ? null : next);
						}}
					>
						{options.map((key) => (
							<DropdownMenuRadioItem key={key} value={key}>
								<span className={styles.rangeOption}>
									<span className={styles.rangeOptionTitle}>
										{monthTitle(key, currentKey)}
									</span>
									<span className={styles.rangeOptionSub}>
										{monthRangeLabel(key)}
									</span>
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function ScopeSwitch({
	value,
	onChange,
	disabled = false,
}: {
	value: OverviewScope;
	onChange?: (next: OverviewScope) => void;
	disabled?: boolean;
}) {
	return (
		<div
			className={styles.scopeSwitch}
			role="group"
			aria-label="Whose numbers to show"
		>
			{OVERVIEW_SCOPES.map((scope) => {
				const meta = SCOPE_META[scope];
				const active = value === scope;
				return (
					<button
						key={scope}
						type="button"
						disabled={disabled}
						aria-pressed={active}
						className={`${styles.scopeBtn} ${active ? styles.scopeBtnOn : ""}`}
						onClick={() => {
							if (!active) onChange?.(scope);
						}}
					>
						<span className={styles.scopeIcon}>
							<Icon icon={meta.icon} />
						</span>
						{meta.label}
					</button>
				);
			})}
		</div>
	);
}

function MonthRangeChip({
	currentKey,
	monthKey,
}: {
	currentKey: string;
	monthKey: string;
}) {
	return (
		<button
			type="button"
			className={styles.range}
			disabled
			aria-label={`${monthTitle(monthKey, currentKey)}, ${monthRangeLabel(monthKey)}`}
		>
			<span className={styles.rangeLeft}>
				<Icon icon={Calendar} className="text-[12px] text-[#7a7890]" />
				<span>
					<b suppressHydrationWarning>{monthTitle(monthKey, currentKey)}</b>
					<small suppressHydrationWarning>{monthRangeLabel(monthKey)}</small>
				</span>
			</span>
			<Icon icon={ChevronRight} className="text-[11px] text-[#a5a3b5]" />
		</button>
	);
}
