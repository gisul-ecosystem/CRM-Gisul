import {
	createLoader,
	createParser,
	parseAsStringLiteral,
} from "nuqs/server";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { isYearMonth } from "./overview-month";

export const OVERVIEW_SCOPES = ["me", "everyone"] as const;

export type OverviewScope = (typeof OVERVIEW_SCOPES)[number];

export const parseAsYearMonth = createParser({
	parse(value) {
		if (!isYearMonth(value)) return null;
		return value;
	},
	serialize(value) {
		return value;
	},
});

export const overviewParsers = {
	[SEARCH_PARAM.overview.scope]:
		parseAsStringLiteral(OVERVIEW_SCOPES).withDefault("everyone"),
	[SEARCH_PARAM.overview.month]: parseAsYearMonth,
};

export const loadOverviewSearchParams = createLoader(overviewParsers);
