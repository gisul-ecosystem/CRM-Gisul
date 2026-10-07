"use client";

import Upload from "@carbon/icons-react/es/Upload";
import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import styles from "./deals-design.module.css";

function downloadText(filename: string, contents: string) {
	const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function ImportDealsSheet() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const fileId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [csv, setCsv] = useState("");
	const [fileName, setFileName] = useState("");

	const template = useQuery({
		...trpc.deals.importTemplate.queryOptions(),
		enabled: open,
	});

	const importCsv = useMutation(
		trpc.deals.importCsv.mutationOptions({
			onSuccess: async (result) => {
				await cache.deal();
				await queryClient.invalidateQueries({
					queryKey: trpc.deals.pathKey(),
				});
				const parts = [
					result.created > 0 ? `${result.created} created` : null,
					result.updated > 0 ? `${result.updated} updated` : null,
					result.failed > 0 ? `${result.failed} failed` : null,
				].filter(Boolean);
				toast.success(parts.join(" · ") || "Import finished.");
				if (result.errors[0]) {
					toast.message(
						`Line ${result.errors[0].line}: ${result.errors[0].message}`,
					);
				}
				setOpen(false);
				setCsv("");
				setFileName("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setCsv("");
					setFileName("");
				}
			}}
		>
			<SheetTrigger asChild>
				<button type="button" className={styles.btnOutline}>
					<Icon icon={Upload} />
					Import
				</button>
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Import deals</SheetTitle>
					<SheetDescription>
						Upload a CSV. Matching name and company update existing deals. New
						rows create deals.
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
					<Field>
						<FieldLabel htmlFor={fileId}>CSV file</FieldLabel>
						<input
							ref={inputRef}
							id={fileId}
							type="file"
							accept=".csv,text/csv"
							className="block w-full text-sm"
							onChange={async (event) => {
								const file = event.target.files?.[0];
								if (!file) return;
								const text = await file.text();
								setCsv(text);
								setFileName(file.name);
							}}
						/>
						<FieldDescription>
							{fileName
								? `Selected ${fileName}.`
								: "Columns: name, company, ownerEmail, product, stage, amount, currency, expectedCloseDate, closedReason."}
						</FieldDescription>
					</Field>

					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={!template.data}
							onClick={() => {
								if (!template.data) return;
								downloadText(template.data.filename, template.data.csv);
							}}
						>
							Download template
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => inputRef.current?.click()}
						>
							Choose file
						</Button>
					</div>
				</div>

				<SheetFooter>
					<Button
						disabled={importCsv.isPending || csv.trim() === ""}
						onClick={() => importCsv.mutate({ csv })}
					>
						{importCsv.isPending ? <Spinner data-icon="inline-start" /> : null}
						Import deals
					</Button>
					<SheetClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
