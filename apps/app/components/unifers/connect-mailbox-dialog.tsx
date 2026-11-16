"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { accountsApi } from "@/lib/unifers/api";
import { useUnifersCache } from "@/lib/unifers/cache";

const EMPTY = {
	email: "",
	fromName: "",
	password: "",
	smtpHost: "",
	smtpPort: "465",
	imapHost: "",
	imapPort: "993",
};

export function ConnectMailboxDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const id = useId();
	const cache = useUnifersCache();
	const [form, setForm] = useState(EMPTY);
	const set = (key: keyof typeof EMPTY, value: string) =>
		setForm((current) => ({ ...current, [key]: value }));

	const smtp = useMutation({
		mutationFn: () =>
			accountsApi.connectSmtp({
				provider: "smtp",
				email: form.email.trim(),
				fromName: form.fromName.trim(),
				password: form.password,
				smtp: { host: form.smtpHost.trim(), port: Number(form.smtpPort) },
				imap: { host: form.imapHost.trim(), port: Number(form.imapPort) },
			}),
		onSuccess: async (result) => {
			await cache.everything();
			if (result.account?.status === "verified") {
				toast.success(`${result.account.email} is connected and verified.`);
				setForm(EMPTY);
				onClose();
			} else {
				toast.error(
					result.account?.lastError ??
						"Saved, but Unifers could not sign in. Check the settings.",
				);
			}
		},
		onError: (error) => toast.error(error.message),
	});

	const google = useMutation({
		mutationFn: () => accountsApi.connectGoogle(),
		onSuccess: (result) => {
			if (result.authUrl) {
				window.open(result.authUrl, "_blank", "noopener");
				toast.success(
					"Approve access in the new tab. The mailbox appears here a moment after.",
				);
				onClose();
			}
		},
		onError: (error) => toast.error(error.message),
	});

	const ready =
		form.email.includes("@") &&
		form.password !== "" &&
		form.smtpHost.trim() !== "" &&
		form.imapHost.trim() !== "" &&
		Number(form.smtpPort) > 0 &&
		Number(form.imapPort) > 0;

	const field = (
		key: keyof typeof EMPTY,
		label: string,
		type = "text",
		placeholder = "",
	) => (
		<Field>
			<FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
			<Input
				id={`${id}-${key}`}
				type={type}
				value={form[key]}
				placeholder={placeholder}
				autoComplete={type === "password" ? "new-password" : "off"}
				onChange={(event) => set(key, event.target.value)}
			/>
		</Field>
	);

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Connect a Unifers mailbox</DialogTitle>
					<DialogDescription>
						Unifers signs in to both servers before it answers. The password
						goes straight to Unifers and is never stored in the CRM.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<div className="grid gap-4 sm:grid-cols-2">
						{field("email", "Email address", "email", "sarah@acme.com")}
						{field("fromName", "Display name", "text", "Sarah from Acme")}
					</div>
					{field("password", "Password or app password", "password")}
					<div className="grid gap-4 sm:grid-cols-2">
						{field("smtpHost", "SMTP server", "text", "smtp.acme.com")}
						{field("smtpPort", "SMTP port", "number")}
						{field("imapHost", "IMAP server", "text", "imap.acme.com")}
						{field("imapPort", "IMAP port", "number")}
					</div>
				</FieldGroup>
				<DialogFooter>
					<Button
						variant="outline"
						disabled={google.isPending}
						onClick={() => google.mutate()}
					>
						Use a Google mailbox instead
					</Button>
					<Button
						disabled={!ready || smtp.isPending}
						onClick={() => smtp.mutate()}
					>
						{smtp.isPending ? "Checking…" : "Connect"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
