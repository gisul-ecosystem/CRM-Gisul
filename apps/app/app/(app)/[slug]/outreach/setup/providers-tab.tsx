"use client";

import Add from "@carbon/icons-react/es/Add";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { OutreachStatus } from "@/components/outreach/status";
import { type ProviderInput, sendingApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { DATE_TIME } from "@/lib/outreach/format";
import { PROVIDER_STATUS } from "@/lib/outreach/labels";
import {
	SEND_FORMATS,
	type SendFormat,
	ZEPTO_REGIONS,
	type ZeptoRegion,
} from "@/lib/outreach/schemas/enums";
import type { Provider } from "@/lib/outreach/schemas/sending";

const PROVIDER_LIMIT = 100;

const TYPE_LABEL = {
	microsoft: "Microsoft 365",
	zeptomail: "ZeptoMail",
	google: "Google Workspace",
} as const;

const SEND_FORMAT_LABEL = {
	outlook: {
		label: "Outlook standard",
		description:
			"Microsoft builds the email like one typed in Outlook. A follow-up is a real reply in the same conversation.",
	},
	mime: {
		label: "Raw MIME",
		description:
			"The engine builds the whole email itself, with its own Message-ID and List-Unsubscribe header.",
	},
} as const satisfies Record<SendFormat, { label: string; description: string }>;

const REGION_LABEL = {
	in: "India (zeptomail.zoho.in)",
	com: "United States (zeptomail.zoho.com)",
	eu: "Europe (zeptomail.zoho.eu)",
	"com.au": "Australia (zeptomail.zoho.com.au)",
} as const satisfies Record<ZeptoRegion, string>;

type Editing = { provider: Provider | null } | null;

export function ProvidersTab({ canManage }: { canManage: boolean }) {
	const cache = useOutreachCache();
	const [editing, setEditing] = useState<Editing>(null);
	const [toDelete, setToDelete] = useState<Provider | null>(null);

	const providers = useQuery({
		queryKey: [...outreachKeys.providers, "list"],
		queryFn: () => sendingApi.providers({ page: 1, limit: PROVIDER_LIMIT }),
	});

	const verify = useMutation({
		mutationFn: (id: string) => sendingApi.verifyProvider(id),
		onSuccess: async (provider) => {
			await cache.sending();
			if (provider.status === "connected")
				toast.success(`${provider.name} is connected.`);
			else
				toast.error(
					provider.lastError ?? `${provider.name} could not connect.`,
				);
		},
		onError: (error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => sendingApi.removeProvider(id),
		onSuccess: async () => {
			await cache.sending();
			setToDelete(null);
			toast.success("Connection deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const rows = providers.data?.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs">
					A connection lets Outreach send, and read bounces and replies, for the
					inboxes that use it. Secrets are stored encrypted and never shown
					again.
				</p>
				{canManage ? (
					<Button onClick={() => setEditing({ provider: null })}>
						<Icon icon={Add} data-icon="inline-start" />
						Add connection
					</Button>
				) : null}
			</div>

			<SetupGuide />

			{providers.isPending ? (
				<Skeleton className="h-32 w-full rounded-lg" />
			) : providers.isError ? (
				<p className="text-destructive text-xs">{providers.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No connection yet</EmptyTitle>
						<EmptyDescription>
							Add a Microsoft 365 or ZeptoMail connection before adding inboxes.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{ id: "name", header: "Connection" },
						{ id: "status", header: "Status" },
						{ id: "format", header: "Format" },
						{ id: "permissions", header: "Permissions" },
						{ id: "inboxes", header: "Inboxes", align: "right" },
						...(canManage
							? [{ id: "actions", srLabel: "Actions", width: "w-12" }]
							: []),
					]}
				>
					{rows.map((provider) => (
						<SimpleTableRow key={provider.id}>
							<TableCell className="px-3">
								<p className="font-medium">{provider.name}</p>
								<p className="text-muted-foreground text-xs">
									{TYPE_LABEL[provider.type]}
									{provider.type === "zeptomail" && provider.region
										? ` · ${provider.region}`
										: provider.tenantId
											? ` · tenant ${provider.tenantId.slice(0, 8)}…`
											: ""}
								</p>
							</TableCell>
							<TableCell className="px-3">
								<OutreachStatus status={PROVIDER_STATUS[provider.status]} />
								{provider.lastError ? (
									<p className="max-w-64 text-destructive text-xs">
										{provider.lastError}
									</p>
								) : provider.lastCheckedAt ? (
									<p className="text-muted-foreground text-xs">
										Checked{" "}
										<LocalDateTime
											date={provider.lastCheckedAt}
											options={DATE_TIME}
										/>
									</p>
								) : null}
							</TableCell>
							<TableCell className="px-3 text-muted-foreground text-xs">
								{provider.type === "zeptomail"
									? "Built by the engine"
									: SEND_FORMAT_LABEL[provider.sendFormat].label}
							</TableCell>
							<TableCell className="px-3 text-xs">
								{provider.type !== "microsoft" ? (
									<span className="text-muted-foreground">—</span>
								) : provider.grantedPermissions === null ? (
									<span className="text-muted-foreground">
										Not checked. Press Verify.
									</span>
								) : (
									<div className="flex flex-col gap-0.5">
										<span>
											{provider.grantedPermissions.join(", ") || "None"}
										</span>
										{!provider.grantedPermissions.includes("Mail.Read") ? (
											<span className="text-warning">
												Mail.Read missing: bounces and replies are not read.
											</span>
										) : null}
									</div>
								)}
							</TableCell>
							<TableCell className="px-3 text-right tabular-nums">
								{provider.inboxCount}
							</TableCell>
							{canManage ? (
								<TableCell className="px-3">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Actions for ${provider.name}`}
											>
												<Icon icon={OverflowMenuHorizontal} />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												disabled={verify.isPending}
												onSelect={() => verify.mutate(provider.id)}
											>
												Verify
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={() => setEditing({ provider })}
											>
												Edit
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => setToDelete(provider)}
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

			<ProviderDialog editing={editing} onClose={() => setEditing(null)} />
			<ConfirmDialog
				open={toDelete !== null}
				title={`Delete “${toDelete?.name ?? ""}”?`}
				description="Inboxes that send through it stop sending until they get another connection."
				action="Delete"
				pending={remove.isPending}
				onConfirm={() => (toDelete ? remove.mutate(toDelete.id) : undefined)}
				onClose={() => setToDelete(null)}
			/>
		</div>
	);
}

function ProviderDialog({
	editing,
	onClose,
}: {
	editing: Editing;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={editing !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				{editing ? (
					<ProviderForm
						key={editing.provider?.id ?? "new"}
						provider={editing.provider}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function ProviderForm({
	provider,
	onClose,
}: {
	provider: Provider | null;
	onClose: () => void;
}) {
	const nameId = useId();
	const tenantId = useId();
	const clientId = useId();
	const secretId = useId();
	const cache = useOutreachCache();
	const editing = provider !== null;
	const [type, setType] = useState<"microsoft" | "zeptomail">(
		provider?.type === "zeptomail" ? "zeptomail" : "microsoft",
	);
	const [name, setName] = useState(provider?.name ?? "");
	const [tenant, setTenant] = useState(provider?.tenantId ?? "");
	const [client, setClient] = useState(provider?.clientId ?? "");
	const [secret, setSecret] = useState("");
	const [sendFormat, setSendFormat] = useState<SendFormat>(
		provider?.sendFormat ?? "outlook",
	);
	const [region, setRegion] = useState<ZeptoRegion>(provider?.region ?? "in");

	const save = useMutation({
		mutationFn: () => {
			if (provider) {
				return sendingApi.updateProvider(
					provider.id,
					type === "microsoft"
						? {
								name: name.trim(),
								tenantId: tenant.trim(),
								clientId: client.trim(),
								clientSecret: secret.trim() || undefined,
								sendFormat,
							}
						: {
								name: name.trim(),
								region,
								apiToken: secret.trim() || undefined,
							},
				);
			}
			const input: ProviderInput =
				type === "microsoft"
					? {
							type,
							name: name.trim(),
							tenantId: tenant.trim(),
							clientId: client.trim(),
							clientSecret: secret.trim(),
							sendFormat,
						}
					: { type, name: name.trim(), region, apiToken: secret.trim() };
			return sendingApi.createProvider(input);
		},
		onSuccess: async (saved) => {
			await cache.sending();
			toast.success(
				saved.status === "connected"
					? `${saved.name} is connected.`
					: `${saved.name} saved. ${saved.lastError ?? "Press Verify to check it."}`,
			);
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	const ready =
		name.trim() &&
		(editing || secret.trim()) &&
		(type === "zeptomail" || (tenant.trim() && client.trim()));

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{editing ? "Edit connection" : "Add connection"}
				</DialogTitle>
				<DialogDescription>
					{type === "microsoft"
						? "An app registration with application permissions. No mailbox password is stored."
						: "A ZeptoMail Send Mail token. ZeptoMail only sends; replies are read with a Microsoft connection."}
				</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<Field>
					<FieldLabel>Type</FieldLabel>
					<Select
						value={type}
						disabled={editing}
						onValueChange={(next) =>
							next === "microsoft" || next === "zeptomail"
								? setType(next)
								: undefined
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="microsoft">Microsoft 365</SelectItem>
							<SelectItem value="zeptomail">ZeptoMail</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={nameId}>Name</FieldLabel>
					<Input
						id={nameId}
						value={name}
						placeholder="e.g. Racko M365"
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				{type === "microsoft" ? (
					<>
						<Field>
							<FieldLabel htmlFor={tenantId}>Directory (tenant) ID</FieldLabel>
							<Input
								id={tenantId}
								value={tenant}
								placeholder="00000000-0000-0000-0000-000000000000"
								onChange={(event) => setTenant(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={clientId}>
								Application (client) ID
							</FieldLabel>
							<Input
								id={clientId}
								value={client}
								placeholder="00000000-0000-0000-0000-000000000000"
								onChange={(event) => setClient(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={secretId}>Client secret value</FieldLabel>
							<Input
								id={secretId}
								type="password"
								value={secret}
								placeholder={
									editing ? "Leave empty to keep the saved secret" : ""
								}
								onChange={(event) => setSecret(event.target.value)}
							/>
							<FieldDescription>
								The Value column, not the Secret ID. Write down its expiry date.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>Sending format</FieldLabel>
							<Select
								value={sendFormat}
								onValueChange={(next) => {
									const match = SEND_FORMATS.find((value) => value === next);
									if (match) setSendFormat(match);
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SEND_FORMATS.map((format) => (
										<SelectItem key={format} value={format}>
											{SEND_FORMAT_LABEL[format].label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								{SEND_FORMAT_LABEL[sendFormat].description}
							</FieldDescription>
						</Field>
					</>
				) : (
					<>
						<Field>
							<FieldLabel>Region</FieldLabel>
							<Select
								value={region}
								onValueChange={(next) => {
									const match = ZEPTO_REGIONS.find((value) => value === next);
									if (match) setRegion(match);
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ZEPTO_REGIONS.map((value) => (
										<SelectItem key={value} value={value}>
											{REGION_LABEL[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								The data centre of your ZeptoMail account.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={secretId}>Send Mail token</FieldLabel>
							<Input
								id={secretId}
								type="password"
								value={secret}
								placeholder={
									editing
										? "Leave empty to keep the saved token"
										: "Zoho-enczapikey …"
								}
								onChange={(event) => setSecret(event.target.value)}
							/>
						</Field>
					</>
				)}
			</FieldGroup>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
				<Button
					disabled={!ready || save.isPending}
					onClick={() => save.mutate()}
				>
					{save.isPending ? "Saving…" : "Save and verify"}
				</Button>
			</DialogFooter>
		</>
	);
}

function SetupGuide() {
	return (
		<div className="flex flex-col gap-2">
			<Collapsible className="rounded-lg border p-3 text-xs">
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="sm">
						How to get the Microsoft 365 values (one-time setup)
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
						<li>
							Microsoft Entra admin center → App registrations → New
							registration. Any name, this directory only, no redirect URI.
						</li>
						<li>
							Copy the Application (client) ID and the Directory (tenant) ID.
						</li>
						<li>
							API permissions → Microsoft Graph → Application permissions:
							Mail.Send to send, Mail.Read for bounces and replies,
							User.Read.All to list mailboxes. Then Grant admin consent.
						</li>
						<li>
							Certificates & secrets → New client secret. Copy the Value right
							away and note the expiry date.
						</li>
						<li>
							Strongly recommended: limit the app to your sending mailboxes with
							Exchange RBAC for Applications. See the Outreach Engine README.
						</li>
					</ol>
				</CollapsibleContent>
			</Collapsible>
			<Collapsible className="rounded-lg border p-3 text-xs">
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="sm">
						How to connect ZeptoMail (one-time setup)
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
						<li>Sign in to ZeptoMail on your region's site.</li>
						<li>
							Domains → Add domain → add the SPF, DKIM and bounce records, then
							Verify.
						</li>
						<li>
							Mail Agents → link the domain → SMTP/API → copy the Send Mail
							token.
						</li>
						<li>
							Add connection here → ZeptoMail → choose the region → paste the
							token.
						</li>
						<li>
							On each inbox, choose this connection under Send through. Read
							replies with a Microsoft connection.
						</li>
					</ol>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
