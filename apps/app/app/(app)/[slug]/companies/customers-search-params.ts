import { createLoader, parseAsStringLiteral } from "nuqs/server";
import { SEARCH_PARAM } from "@/lib/search-param-keys";

export const CUSTOMER_VIEWS = ["companies", "contacts"] as const;
export type CustomerView = (typeof CUSTOMER_VIEWS)[number];

export const customersParsers = {
	[SEARCH_PARAM.customers.view]: parseAsStringLiteral(CUSTOMER_VIEWS).withDefault(
		"companies",
	),
};

export const loadCustomersSearchParams = createLoader(customersParsers);
