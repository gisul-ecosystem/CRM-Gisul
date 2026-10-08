import { createListSearchParams } from "@/components/data-table/list-search-params";

export const membersSearchParams = createListSearchParams({
	defaultSort: "joinedAt",
	defaultDir: "asc",
	facetIds: ["role", "team", "status"] as const,
});
