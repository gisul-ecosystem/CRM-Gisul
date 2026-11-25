"use client";

import Download from "@carbon/icons-react/es/Download";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { companiesSearchParams } from "./companies-search-params";
import styles from "./customers-design.module.css";
import { ImportCompaniesSheet } from "./import-companies-sheet";

function downloadText(filename: string, contents: string) {
	const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function CompaniesHeaderActions() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [values] = useQueryStates(companiesSearchParams.parsers);
	const input = companiesSearchParams.toInput(values);

	const exportCsv = useMutation({
		mutationFn: () =>
			queryClient.fetchQuery(
				trpc.companies.exportCsv.queryOptions({
					...input,
					page: 1,
				}),
			),
		onSuccess: (result) => {
			downloadText(result.filename, result.csv);
			toast.success(`Exported ${result.rowCount} companies.`);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<button
				type="button"
				className={styles.btnOutline}
				disabled={exportCsv.isPending}
				onClick={() => exportCsv.mutate()}
			>
				{exportCsv.isPending ? (
					<Spinner data-icon="inline-start" />
				) : (
					<Icon icon={Download} />
				)}
				Export
			</button>
			<ImportCompaniesSheet triggerClassName={styles.btnOutline} />
		</>
	);
}
