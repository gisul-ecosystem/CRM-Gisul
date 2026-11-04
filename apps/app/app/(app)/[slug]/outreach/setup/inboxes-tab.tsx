"use client";

import Add from "@carbon/icons-react/es/Add";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
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
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { OutreachStatus } from "@/components/outreach/status";
import { type InboxUpdate, sendingApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { INBOX } from "@/lib/outreach/campaign-rules";
import { DATE_TIME, gapLabel } from "@/lib/outreach/format";
import { INBOX_STATUS } from "@/lib/outreach/labels";
import type { SendingInbox } from "@/lib/outreach/schemas/sending";

const PICKER_LIMIT = 100;
const SAME_AS_SENDER = "same";

function useSendingChoices() {
	const domains = useQuery({
		queryKey: [...outreachKeys.domains, "list"],
		queryFn: () => sendingApi.domains({ page: 1, limit: PICKER_LIMIT }),
	});
	const providers = useQuery({
		queryKey: [...outreachKeys.providers, "list"],
		queryFn: () => sendingApi.providers({ page: 1, limit: PICKER_LIMIT }),
	});
	return {
		domains: domains.data?.data ?? [],
		providers: providers.data?.data ?? [],
	};
}

export function InboxesTab({
	canManage,
	viewerEmail,
}: {
	canManage: boolean;
	viewerEmail: string;
}) {
	const cache = useOutreachCache();
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<SendingInbox | null>(null);
	const [testing, setTesting] = useState<SendingInbox | null>(null);
	const [toDelete, setToDelete] = useState<SendingInbox | null>(null);

	const inboxes = useQuery({
		queryKey: [...outreachKeys.inboxes, "list"],
		queryFn: () => sendingApi.inboxes({ page: 1, limit: PICKER_LIMIT }),
	});

	const pauseResume = useMutation({
		mutationFn: (inbox: SendingInbox) =>
			inbox.status === "active"
				? sendingApi.pauseInbox(inbox.id, "Paused from the CRM")
				: sendingApi.resumeInbox(inbox.id),
		onSuccess: async (inbox) => {
			await cache.sending();
			toast.success(
				inbox.status === "active"
					? `${inbox.email} sends again.`
					: `${inbox.email} paused.`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => sendingApi.removeInbox(id),
		onSuccess: async () => {
			await cache.sending();
			setToDelete(null);
			toast.success("Inbox deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const rows = inboxes.data?.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs">
					Each inbox sends at most its daily limit, with a random gap between
					emails. Start a new domain at ten a day and raise it slowly.
				</p>
				{canManage ? (
					<Button onClick={() => setAdding(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						Add inbox
					</Button>
				) : null}
			</div>

			{inboxes.isPending ? (
				<Skeleton className="h-32 w-full rounded-lg" />
			) : inboxes.isError ? (
				<p className="text-destructive text-xs">{inboxes.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No sending inbox yet</EmptyTitle>
						<EmptyDescription>
							Add a domain and a connection first, then add its mailboxes here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "email", header: "Inbox" },
						{ id: "status", header: "Status" },
						{ id: "through", header: "Sends through" },
						{ id: "limit", header: "Limit and gap" },
						{ id: "last", header: "Last sent" },
						...(canManage
							? [{ id: "actions", srLabel: "Actions", width: "w-12" }]
							: []),
					]}
				>
					{rows.map((inbox) => (
						<SimpleTableRow key={inbox.id}>
							<TableCell className="px-3">
								<p className="font-medium">{inbox.email}</p>
								<p className="text-muted-foreground text-xs">
									{inbox.displayName || "No display name"}
									{inbox.senderRole ? ` · ${inbox.senderRole}` : ""}
								</p>
							</TableCell>
							<TableCell className="px-3">
								<OutreachStatus status={INBOX_STATUS[inbox.status]} />
								{inbox.pauseReason ? (
									<p className="max-w-56 text-muted-foreground text-xs">
										{inbox.pauseReason}
									</p>
								) : null}
							</TableCell>
							<TableCell className="px-3 text-xs">
								<p>{inbox.providerName ?? "No connection"}</p>
								{inbox.readingConnectionName ? (
									<p className="text-muted-foreground">
										Reads with {inbox.readingConnectionName}
									</p>
								) : null}
							</TableCell>
							<TableCell className="px-3 text-xs">
								<p className="tabular-nums">{inbox.dailyLimit}/day</p>
								<p className="text-muted-foreground">
									{gapLabel(inbox.minGapSeconds)}–
									{gapLabel(inbox.maxGapSeconds)} apart
								</p>
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								{inbox.lastSentAt ? (
									<LocalDateTime date={inbox.lastSentAt} options={DATE_TIME} />
								) : (
									"Never"
								)}
							</TableCell>
							{canManage ? (
								<TableCell className="px-3">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Actions for ${inbox.email}`}
											>
												<Icon icon={OverflowMenuHorizontal} />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => setEditing(inbox)}>
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => setTesting(inbox)}>
												Send test email
											</DropdownMenuItem>
											<DropdownMenuItem
												disabled={pauseResume.isPending}
												onSelect={() => pauseResume.mutate(inbox)}
											>
												{inbox.status === "active" ? "Pause" : "Resume"}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => setToDelete(inbox)}
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

			<AddInboxDialog open={adding} onOpenChange={setAdding} />
			<EditInboxDialog inbox={editing} onClose={() => setEditing(null)} />
			<TestInboxDialog
				inbox={testing}
				defaultTo={viewerEmail}
				onClose={() => setTesting(null)}
			/>
			<ConfirmDialog
				open={toDelete !== null}
				title={`Delete ${toDelete?.email ?? "this inbox"}?`}
				description="Campaigns stop sending from it. Its sending history is kept."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}

function AddInboxDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [mode, setMode] = useState<"import" | "manual">("import");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add inbox</DialogTitle>
					<DialogDescription>
						Pick mailboxes from Microsoft 365, or type one by hand.
					</DialogDescription>
				</DialogHeader>
				<ToggleGroup
					type="single"
					variant="outline"
					value={mode}
					onValueChange={(next) =>
						next === "import" || next === "manual" ? setMode(next) : undefined
					}
					size="sm"
					spacing={1}
				>
					<ToggleGroupItem value="import">From Microsoft 365</ToggleGroupItem>
					<ToggleGroupItem value="manual">By hand</ToggleGroupItem>
				</ToggleGroup>
				{open ? (
					mode === "import" ? (
						<ImportMailboxes onDone={() => onOpenChange(false)} />
					) : (
						<ManualInbox onDone={() => onOpenChange(false)} />
					)
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function ImportMailboxes({ onDone }: { onDone: () => void }) {
	const cache = useOutreachCache();
	const { domains, providers } = useSendingChoices();
	const microsoft = providers.filter(
		(provider) => provider.type === "microsoft",
	);
	const [domainId, setDomainId] = useState<string | null>(null);
	const [providerId, setProviderId] = useState<string | null>(null);
	const [picked, setPicked] = useState<Set<string>>(() => new Set());
	const activeProvider = providerId ?? microsoft[0]?.id ?? null;

	const discovery = useQuery({
		queryKey: [...outreachKeys.inboxes, "discover", domainId, activeProvider],
		queryFn: () =>
			domainId
				? sendingApi.discoverMailboxes(domainId, activeProvider ?? undefined)
				: null,
		enabled: Boolean(domainId),
		retry: false,
	});

	const add = useMutation({
		mutationFn: () => {
			if (!domainId) throw new Error("Choose a domain.");
			return sendingApi.importMailboxes(domainId, {
				emails: [...picked],
				providerConnectionId: activeProvider ?? undefined,
			});
		},
		onSuccess: async (result) => {
			await cache.sending();
			toast.success(
				`${result.imported.length} inbox${result.imported.length === 1 ? "" : "es"} added.${
					result.skipped.length ? ` ${result.skipped.length} skipped.` : ""
				}`,
			);
			onDone();
		},
		onError: (error) => toast.error(error.message),
	});

	const toggle = (email: string) =>
		setPicked((current) => {
			const next = new Set(current);
			if (next.has(email)) next.delete(email);
			else next.add(email);
			return next;
		});

	return (
		<div className="flex flex-col gap-4">
			<Field>
				<FieldLabel>Domain</FieldLabel>
				<Select
					value={domainId ?? undefined}
					onValueChange={(value) => {
						setDomainId(value);
						setPicked(new Set());
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder="Choose a domain" />
					</SelectTrigger>
					<SelectContent>
						{domains.map((domain) => (
							<SelectItem key={domain.id} value={domain.id}>
								{domain.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			{microsoft.length > 1 ? (
				<Field>
					<FieldLabel>Microsoft 365 connection</FieldLabel>
					<Select
						value={activeProvider ?? undefined}
						onValueChange={(value) => {
							setProviderId(value);
							setPicked(new Set());
						}}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{microsoft.map((provider) => (
								<SelectItem key={provider.id} value={provider.id}>
									{provider.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			) : null}

			{!domainId ? null : discovery.isPending ? (
				<Skeleton className="h-24 w-full" />
			) : discovery.isError ? (
				<p className="text-destructive text-xs">{discovery.error.message}</p>
			) : discovery.data && discovery.data.mailboxes.length > 0 ? (
				<ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-lg border">
					{discovery.data.mailboxes.map((mailbox) => (
						<li
							key={mailbox.email}
							className="flex items-center gap-3 px-3 py-2 text-xs"
						>
							<Checkbox
								checked={picked.has(mailbox.email)}
								disabled={mailbox.alreadyAdded || !mailbox.enabled}
								onCheckedChange={() => toggle(mailbox.email)}
								aria-label={`Use ${mailbox.email}`}
							/>
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate font-medium">{mailbox.email}</span>
								<span className="truncate text-muted-foreground">
									{mailbox.displayName}
									{mailbox.alreadyAdded ? " · already added" : ""}
									{!mailbox.enabled ? " · account disabled" : ""}
								</span>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-xs">
					No mailbox found on this domain. Check that the connection has
					User.Read.All.
				</p>
			)}

			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button
					disabled={picked.size === 0 || add.isPending}
					onClick={() => add.mutate()}
				>
					{add.isPending
						? "Adding…"
						: `Add ${picked.size || ""} inbox${picked.size === 1 ? "" : "es"}`}
				</Button>
			</DialogFooter>
		</div>
	);
}

function ManualInbox({ onDone }: { onDone: () => void }) {
	const emailId = useId();
	const nameId = useId();
	const cache = useOutreachCache();
	const { domains, providers } = useSendingChoices();
	const [domainId, setDomainId] = useState<string | null>(null);
	const [providerId, setProviderId] = useState<string | null>(null);
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");

	const create = useMutation({
		mutationFn: () => {
			if (!domainId || !providerId)
				throw new Error("Choose a domain and a connection.");
			return sendingApi.createInbox({
				domainId,
				providerConnectionId: providerId,
				email: email.trim(),
				displayName: displayName.trim(),
			});
		},
		onSuccess: async (inbox) => {
			await cache.sending();
			toast.success(`${inbox.email} added.`);
			onDone();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<div className="flex flex-col gap-4">
			<FieldGroup>
				<Field>
					<FieldLabel>Domain</FieldLabel>
					<Select value={domainId ?? undefined} onValueChange={setDomainId}>
						<SelectTrigger>
							<SelectValue placeholder="Choose a domain" />
						</SelectTrigger>
						<SelectContent>
							{domains.map((domain) => (
								<SelectItem key={domain.id} value={domain.id}>
									{domain.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={emailId}>Email address</FieldLabel>
					<Input
						id={emailId}
						type="email"
						value={email}
						placeholder="sales@yourdomain.com"
						onChange={(event) => setEmail(event.target.value)}
					/>
					<FieldDescription>
						Its domain must be the domain chosen above.
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor={nameId}>Display name</FieldLabel>
					<Input
						id={nameId}
						value={displayName}
						placeholder="Nikhil from Racko"
						onChange={(event) => setDisplayName(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel>Send through</FieldLabel>
					<Select value={providerId ?? undefined} onValueChange={setProviderId}>
						<SelectTrigger>
							<SelectValue placeholder="Choose a connection" />
						</SelectTrigger>
						<SelectContent>
							{providers.map((provider) => (
								<SelectItem key={provider.id} value={provider.id}>
									{provider.name}
									{provider.status === "connected" ? "" : " (not verified)"}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button
					disabled={
						!domainId || !providerId || !email.trim() || create.isPending
					}
					onClick={() => create.mutate()}
				>
					{create.isPending ? "Adding…" : "Add inbox"}
				</Button>
			</DialogFooter>
		</div>
	);
}

function EditInboxDialog({
	inbox,
	onClose,
}: {
	inbox: SendingInbox | null;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={inbox !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="sm:max-w-lg">
				{inbox ? (
					<EditInboxForm key={inbox.id} inbox={inbox} onClose={onClose} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function EditInboxForm({
	inbox,
	onClose,
}: {
	inbox: SendingInbox;
	onClose: () => void;
}) {
	const displayId = useId();
	const signatureId = useId();
	const roleId = useId();
	const limitId = useId();
	const minId = useId();
	const maxId = useId();
	const cache = useOutreachCache();
	const { providers } = useSendingChoices();
	const microsoft = providers.filter(
		(provider) => provider.type === "microsoft",
	);
	const [form, setForm] = useState<
		Required<Omit<InboxUpdate, "readingConnectionId">> & {
			readingConnectionId: string | null;
		}
	>({
		displayName: inbox.displayName,
		senderName: inbox.senderName,
		senderRole: inbox.senderRole,
		providerConnectionId: inbox.providerConnectionId ?? "",
		readingConnectionId: inbox.readingConnectionId,
		dailyLimit: inbox.dailyLimit,
		minGapSeconds: inbox.minGapSeconds,
		maxGapSeconds: inbox.maxGapSeconds,
	});
	const sendsThroughZepto =
		providers.find((provider) => provider.id === form.providerConnectionId)
			?.type === "zeptomail";

	const save = useMutation({
		mutationFn: () =>
			sendingApi.updateInbox(inbox.id, {
				...form,
				providerConnectionId: form.providerConnectionId || undefined,
			}),
		onSuccess: async () => {
			await cache.sending();
			toast.success("Inbox saved.");
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	const set = (patch: Partial<typeof form>) =>
		setForm((current) => ({ ...current, ...patch }));

	return (
		<>
			<DialogHeader>
				<DialogTitle>Edit {inbox.email}</DialogTitle>
				<DialogDescription>
					The signature fills {"{{senderName}}"} and {"{{senderRole}}"} in
					emails.
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={displayId}>Display name</FieldLabel>
					<Input
						id={displayId}
						value={form.displayName}
						onChange={(event) => set({ displayName: event.target.value })}
					/>
					<FieldDescription>
						In Outlook format Microsoft shows the mailbox's own name from
						Microsoft 365. Keep both the same.
					</FieldDescription>
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field>
						<FieldLabel htmlFor={signatureId}>Signature name</FieldLabel>
						<Input
							id={signatureId}
							value={form.senderName}
							placeholder={form.displayName}
							onChange={(event) => set({ senderName: event.target.value })}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={roleId}>Signature role</FieldLabel>
						<Input
							id={roleId}
							value={form.senderRole}
							placeholder="Business Development"
							onChange={(event) => set({ senderRole: event.target.value })}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel>Send through</FieldLabel>
					<Select
						value={form.providerConnectionId || undefined}
						onValueChange={(value) => set({ providerConnectionId: value })}
					>
						<SelectTrigger>
							<SelectValue placeholder="Choose a connection" />
						</SelectTrigger>
						<SelectContent>
							{providers.map((provider) => (
								<SelectItem key={provider.id} value={provider.id}>
									{provider.name}
									{provider.status === "connected" ? "" : " (not verified)"}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				{sendsThroughZepto || form.readingConnectionId ? (
					<Field>
						<FieldLabel>Read replies with</FieldLabel>
						<Select
							value={form.readingConnectionId ?? SAME_AS_SENDER}
							onValueChange={(value) =>
								set({
									readingConnectionId: value === SAME_AS_SENDER ? null : value,
								})
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={SAME_AS_SENDER}>
									Same as Send through
								</SelectItem>
								{microsoft.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldDescription>
							ZeptoMail cannot read mail. Choose a Microsoft connection to see
							bounces and replies.
						</FieldDescription>
					</Field>
				) : null}
				<Field>
					<FieldLabel htmlFor={limitId}>
						Daily limit (emails per day)
					</FieldLabel>
					<Input
						id={limitId}
						type="number"
						min={1}
						max={INBOX.maxDailyLimit}
						value={form.dailyLimit}
						onChange={(event) =>
							set({ dailyLimit: Number(event.target.value) || 1 })
						}
					/>
					{form.dailyLimit > INBOX.warmUpAbove ? (
						<FieldDescription>
							Above {INBOX.warmUpAbove} a day, a new domain risks the spam
							folder. Raise it slowly.
						</FieldDescription>
					) : null}
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field>
						<FieldLabel htmlFor={minId}>Min gap (seconds)</FieldLabel>
						<Input
							id={minId}
							type="number"
							min={INBOX.minGapSeconds}
							max={INBOX.maxGapSeconds}
							value={form.minGapSeconds}
							onChange={(event) =>
								set({
									minGapSeconds:
										Number(event.target.value) || INBOX.minGapSeconds,
								})
							}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={maxId}>Max gap (seconds)</FieldLabel>
						<Input
							id={maxId}
							type="number"
							min={INBOX.minGapSeconds}
							max={INBOX.maxGapSeconds}
							value={form.maxGapSeconds}
							onChange={(event) =>
								set({
									maxGapSeconds:
										Number(event.target.value) || INBOX.minGapSeconds,
								})
							}
						/>
					</Field>
				</div>
			</FieldGroup>
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

function TestInboxDialog({
	inbox,
	defaultTo,
	onClose,
}: {
	inbox: SendingInbox | null;
	defaultTo: string;
	onClose: () => void;
}) {
	const toId = useId();
	const [to, setTo] = useState(defaultTo);

	const send = useMutation({
		mutationFn: () => {
			if (!inbox) throw new Error("No inbox.");
			return sendingApi.testInbox(inbox.id, to.trim());
		},
		onSuccess: (result) => {
			toast.success(
				result.mode === "dry-run"
					? `Dry run: a test to ${result.to} was simulated, not sent.`
					: `Test sent from ${result.from} to ${result.to}.`,
			);
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Dialog
			open={inbox !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send a test from {inbox?.email}</DialogTitle>
					<DialogDescription>
						A short test email, to check the connection end to end.
					</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={toId}>Send to</FieldLabel>
					<Input
						id={toId}
						type="email"
						value={to}
						onChange={(event) => setTo(event.target.value)}
					/>
				</Field>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						disabled={send.isPending || !to.trim()}
						onClick={() => send.mutate()}
					>
						{send.isPending ? "Sending…" : "Send test"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
