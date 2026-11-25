import { formatMoneyCompact } from "@crm/ui/lib/format";
import { DASHBOARD } from "./dashboard-config";

export function chartTopCents(maxCents: number): number {
	if (maxCents <= 0) return 0;
	const units = maxCents / 100;
	const exp = 10 ** Math.floor(Math.log10(units));
	const scaled = units / exp;
	const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
	return Math.round(nice * exp * 100);
}

export function chartYLabels(maxCents: number, currency: string): string[] {
	const top = chartTopCents(maxCents);
	return DASHBOARD.chart.yTickFractions.map((fraction) =>
		formatMoneyCompact(Math.round(top * fraction), currency),
	);
}

export function chartBarPercent(wonCents: number, topCents: number): number {
	if (topCents <= 0 || wonCents <= 0) return 0;
	return Math.max(
		DASHBOARD.chart.minBarPercent,
		Math.round((wonCents / topCents) * 100),
	);
}
