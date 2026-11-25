"use client";

import Download from "@carbon/icons-react/es/Download";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { contactsSearchParams } from "./contacts-search-params";
import { CreateContactSheet } from "./create-contact-sheet";
import { ImportLeadsSheet } from "./import-leads-sheet";
import styles from "./leads-design.module.css";

function downloadText(filename: string, contents: string) {
	const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function LeadsHeaderActions() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [values] = useQueryStates(contactsSearchParams.parsers);
	const input = contactsSearchParams.toInput(values);

	const exportCsv = useMutation({
		mutationFn: () =>
			queryClient.fetchQuery(
				trpc.contacts.exportCsv.queryOptions({
					...input,
					page: 1,
				}),
			),
		onSuccess: (result) => {
			downloadText(result.filename, result.csv);
			toast.success(`Exported ${result.rowCount} leads.`);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<div className={styles.actions}>
			<button
				type="button"
				className={styles.btnSoft}
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
			<ImportLeadsSheet />
			<CreateContactSheet
				triggerLabel="Add Lead"
				triggerClassName={styles.btnPrimary}
			/>
		</div>
	);
}
