import { createListSearchParams } from "@/components/data-table/list-search-params";

export const contactsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: [
		"owner",
		"company",
		"product",
		"leadStatus",
		"leadSource",
		"title",
		"seniority",
		"persona",
		"activity",
	] as const,
});
