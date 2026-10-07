"use client";

import { useQueryState } from "nuqs";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { CompaniesTable } from "./companies-table";
import { CustomersContactsTable } from "./customers-contacts-table";
import { CustomersHeader, CustomersTabs } from "./customers-header";
import styles from "./customers-design.module.css";
import { customersParsers } from "./customers-search-params";

export function CustomersPageClient() {
	const [view] = useQueryState(
		SEARCH_PARAM.customers.view,
		customersParsers[SEARCH_PARAM.customers.view],
	);

	return (
		<div className={styles.wrap}>
			<CustomersHeader />
			<CustomersTabs />
			{view === "contacts" ? <CustomersContactsTable /> : <CompaniesTable />}
		</div>
	);
}
