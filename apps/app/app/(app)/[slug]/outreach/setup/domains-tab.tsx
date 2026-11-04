"use client";

import Add from "@carbon/icons-react/es/Add";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { OutreachStatus } from "@/components/outreach/status";
import { sendingApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { DATE_TIME } from "@/lib/outreach/format";
import { DNS_RESULT, DOMAIN_STATUS } from "@/lib/outreach/labels";
import type { SendingDomain } from "@/lib/outreach/schemas/sending";

const DOMAIN_LIMIT = 100;
const DNS_CHECKS = ["spf", "dkim", "dmarc", "mx"] as const;

export function DomainsTab({ canManage }: { canManage: boolean }) {
	const cache = useOutreachCache();
	const [adding, setAdding] = useState(false);
	const [trackingFor, setTrackingFor] = useState<SendingDomain | null>(null);
	const [toDelete, setToDelete] = useState<SendingDomain | null>(null);

	const domains = useQuery({
		queryKey: [...outreachKeys.domains, "list"],
		queryFn: () => sendingApi.domains({ page: 1, limit: DOMAIN_LIMIT }),
	});

	const recheck = useMutation({
		mutationFn: (id: string) => sendingApi.checkDns(id),
		onSuccess: async (domain) => {
			await cache.sending();
			toast.success(`DNS re-checked for ${domain.name}.`);
		},
		onError: (error) => toast.error(error.message),
	});

	const setStatus = useMutation({
		mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
			sendingApi.updateDomain(id, { status }),
		onSuccess: async (domain) => {
			await cache.sending();
			toast.success(
				domain.status === "paused"
					? `${domain.name} paused. Its inboxes stop sending.`
					: `${domain.name} is active again.`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => sendingApi.removeDomain(id),
		onSuccess: async () => {
			await cache.sending();
			setToDelete(null);
			toast.success("Domain deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const rows = domains.data?.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs">
					Each sending domain needs SPF, DKIM and DMARC, or mail goes to spam.
					Add the records at your DNS host, then press Re-check DNS.
				</p>
				{canManage ? (
					<Button onClick={() => setAdding(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						Add domain
					</Button>
				) : null}
			</div>

			{domains.isPending ? (
				<Skeleton className="h-32 w-full rounded-lg" />
			) : domains.isError ? (
				<p className="text-destructive text-xs">{domains.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No sending domain yet</EmptyTitle>
						<EmptyDescription>
							Add the domain your sending inboxes use, for example tryracko.in.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "name", header: "Domain" },
						{ id: "status", header: "Status" },
						{ id: "dns", header: "DNS" },
						{ id: "tracking", header: "Tracking address" },
						{ id: "inboxes", header: "Inboxes", align: "right" },
						...(canManage
							? [{ id: "actions", srLabel: "Actions", width: "w-12" }]
							: []),
					]}
				>
					{rows.map((domain) => (
						<SimpleTableRow key={domain.id}>
							<TableCell className="px-3">
								<p className="font-medium">{domain.name}</p>
								<p className="text-muted-foreground text-xs">
									{domain.dns.checkedAt ? (
										<>
											Checked{" "}
											<LocalDateTime
												date={domain.dns.checkedAt}
												options={DATE_TIME}
											/>
										</>
									) : (
										"DNS not checked yet"
									)}
								</p>
							</TableCell>
							<TableCell className="px-3">
								<OutreachStatus status={DOMAIN_STATUS[domain.status]} />
							</TableCell>
							<TableCell className="px-3">
								<div className="flex flex-wrap gap-x-3 gap-y-1">
									{DNS_CHECKS.map((check) => (
										<Tooltip key={check}>
											<TooltipTrigger asChild>
												<span className="inline-flex cursor-help items-center gap-1 text-xs">
													<span className="font-medium uppercase">{check}</span>
													<OutreachStatus
														status={DNS_RESULT[domain.dns[check]]}
													/>
												</span>
											</TooltipTrigger>
											<TooltipContent className="max-w-sm break-all">
												{domain.dns.records[check].length > 0
													? domain.dns.records[check].join("\n")
													: "No record found."}
											</TooltipContent>
										</Tooltip>
									))}
								</div>
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								{domain.trackingHost ?? "Default"}
							</TableCell>
							<TableCell className="px-3 text-right tabular-nums">
								{domain.inboxCount}
							</TableCell>
							{canManage ? (
								<TableCell className="px-3">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Actions for ${domain.name}`}
											>
												<Icon icon={OverflowMenuHorizontal} />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												disabled={recheck.isPending}
												onSelect={() => recheck.mutate(domain.id)}
											>
												Re-check DNS
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => setTrackingFor(domain)}>
												Tracking address
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={() =>
													setStatus.mutate({
														id: domain.id,
														status:
															domain.status === "active" ? "paused" : "active",
													})
												}
											>
												{domain.status === "active" ? "Pause" : "Resume"}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => setToDelete(domain)}
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							) : null}
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			<AddDomainDialog open={adding} onOpenChange={setAdding} />
			<TrackingHostDialog
				domain={trackingFor}
				onClose={() => setTrackingFor(null)}
			/>
			<ConfirmDialog
				open={toDelete !== null}
				title={`Delete ${toDelete?.name ?? "this domain"}?`}
				description="Delete its inboxes first. Sending history is kept."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}

function AddDomainDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const nameId = useId();
	const cache = useOutreachCache();
	const [name, setName] = useState("");

	const create = useMutation({
		mutationFn: () => sendingApi.createDomain(name.trim()),
		onSuccess: async (domain) => {
			await cache.sending();
			toast.success(`${domain.name} added. DNS is checked now.`);
			setName("");
			onOpenChange(false);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a sending domain</DialogTitle>
					<DialogDescription>
						The part after @ in your sending inboxes.
					</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={nameId}>Domain</FieldLabel>
					<Input
						id={nameId}
						value={name}
						placeholder="tryracko.in"
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						disabled={create.isPending || !name.trim()}
						onClick={() => create.mutate()}
					>
						{create.isPending ? "Adding…" : "Add"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function TrackingHostDialog({
	domain,
	onClose,
}: {
	domain: SendingDomain | null;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={domain !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				{domain ? (
					<TrackingHostForm key={domain.id} domain={domain} onClose={onClose} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function TrackingHostForm({
	domain,
	onClose,
}: {
	domain: SendingDomain;
	onClose: () => void;
}) {
	const hostId = useId();
	const cache = useOutreachCache();
	const [host, setHost] = useState(domain.trackingHost ?? "");

	const save = useMutation({
		mutationFn: () =>
			sendingApi.updateDomain(domain.id, { trackingHost: host.trim() || null }),
		onSuccess: async () => {
			await cache.sending();
			toast.success("Tracking address saved.");
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>Tracking address for {domain.name}</DialogTitle>
				<DialogDescription>
					Links in emails from this domain start with this address, so they
					match the sender. Point it at the Outreach Engine in your DNS first.
				</DialogDescription>
			</DialogHeader>
			<Field>
				<FieldLabel htmlFor={hostId}>Address</FieldLabel>
				<Input
					id={hostId}
					value={host}
					placeholder={`go.${domain.name}`}
					onChange={(event) => setHost(event.target.value)}
				/>
				<FieldDescription>
					The domain itself or one of its subdomains. Empty uses the default
					tracking address.
				</FieldDescription>
			</Field>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button disabled={save.isPending} onClick={() => save.mutate()}>
					{save.isPending ? "Saving…" : "Save"}
				</Button>
			</DialogFooter>
		</>
	);
}
