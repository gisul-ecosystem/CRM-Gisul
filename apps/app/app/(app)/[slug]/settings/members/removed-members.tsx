"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function RemovedMembers() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const isOwner = workspace.data?.canRemoveMembers ?? false;

	const removed = useQuery({
		...trpc.workspace.removedMembers.queryOptions(),
		enabled: isOwner,
	});

	const allow = useMutation(
		trpc.workspace.allowMemberAgain.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Allowed again. They join on their next sign-in.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const rows = removed.data ?? [];
	if (!isOwner || rows.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Removed people</CardTitle>
				<CardDescription>
					They cannot sign in. Allow someone again and they rejoin as a member
					on their next sign-in.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<SimpleTable
					columns={[
						{ id: "name", header: "Name" },
						{ id: "removed", header: "Removed" },
						{ id: "actions", srLabel: "Actions", align: "right" },
					]}
				>
					{rows.map((row) => (
						<SimpleTableRow key={row.userId}>
							<TableCell className="max-w-72 px-3">
								<p className="truncate">{row.name}</p>
								<p className="truncate text-muted-foreground text-xs">
									{row.email}
								</p>
							</TableCell>
							<TableCell className="px-3 text-muted-foreground">
								<LocalRelativeTime date={row.removedAt} />
							</TableCell>
							<TableCell className="px-3 text-right">
								<Button
									variant="outline"
									size="sm"
									disabled={allow.isPending}
									onClick={() => allow.mutate({ userId: row.userId })}
								>
									Allow again
								</Button>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			</CardContent>
		</Card>
	);
}
