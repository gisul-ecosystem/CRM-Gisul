"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTRPC } from "@/lib/trpc/client";
import { ImportLeadsSheet } from "../contacts/import-leads-sheet";
import { contactsSearchParams } from "../contacts/contacts-search-params";
import { CompaniesHeaderActions } from "./companies-header-actions";
import { companiesSearchParams } from "./companies-search-params";
import { CreateCompanySheet } from "./create-company-sheet";
import styles from "./customers-design.module.css";
import {
	CUSTOMER_VIEWS,
	type CustomerView,
	customersParsers,
} from "./customers-search-params";

export function CustomersHeader() {
	const [view] = useQueryState(
		SEARCH_PARAM.customers.view,
		customersParsers[SEARCH_PARAM.customers.view],
	);

	return (
		<header className={styles.top}>
			<div className={styles.topText}>
				<h1 className={styles.title}>Customers</h1>
				<p className={styles.subtitle}>
					Manage customer companies and the people you work with.
				</p>
			</div>
			<div className={styles.actions}>
				{view === "companies" ? <CompaniesHeaderActions /> : null}
				{view === "contacts" ? (
					<ImportLeadsSheet triggerClassName={styles.btnOutline} />
				) : null}
				<CreateCompanySheet
					triggerLabel="Add Company"
					triggerClassName={styles.btnPrimary}
				/>
			</div>
		</header>
	);
}

export function CustomersTabs() {
	const trpc = useTRPC();
	const [view, setView] = useQueryState(
		SEARCH_PARAM.customers.view,
		customersParsers[SEARCH_PARAM.customers.view],
	);

	const companies = useQuery(
		trpc.companies.list.queryOptions(companiesSearchParams.defaultInput()),
	);
	const contacts = useQuery(
		trpc.contacts.list.queryOptions(contactsSearchParams.defaultInput()),
	);

	const counts: Record<CustomerView, number> = {
		companies: companies.data?.total ?? 0,
		contacts: contacts.data?.total ?? 0,
	};

	return (
		<div className={styles.tabs}>
			{CUSTOMER_VIEWS.map((id) => (
				<button
					key={id}
					type="button"
					className={`${styles.tab} ${view === id ? styles.tabOn : ""}`}
					onClick={() => setView(id)}
				>
					{id === "companies" ? "Companies" : "Contacts"}
					<span className={styles.tabBadge}>{counts[id]}</span>
				</button>
			))}
		</div>
	);
}
