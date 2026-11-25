"use client";

import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { mailApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import type { TrackingConfig } from "@/lib/outreach/schemas/mail";

export type LinkTarget = { path: string; domainId: string };

export const EMPTY_LINK_TARGET: LinkTarget = { path: "", domainId: "" };

const DEFAULT_DOMAIN = "default";

export function useTrackingConfig() {
	return useQuery({
		queryKey: [...outreachKeys.tracking, "config"],
		queryFn: mailApi.trackingConfig,
		staleTime: 60_000,
	});
}

export function destinationOf(path: string, homepage: string): string {
	try {
		return path.trim() ? new URL(path.trim(), homepage).toString() : homepage;
	} catch {
		return homepage;
	}
}

export function linkBaseOf(
	target: LinkTarget,
	config: TrackingConfig | undefined,
): string {
	const domain = config?.domains.find((entry) => entry.id === target.domainId);
	return domain ? `https://${domain.trackingHost}` : (config?.baseUrl ?? "");
}

export function savedLinkTarget(
	saved: { destinationUrl: string | null; domainId: string | null },
	config: TrackingConfig | undefined,
): LinkTarget {
	let path = "";
	if (saved.destinationUrl && config) {
		try {
			const destination = new URL(saved.destinationUrl);
			if (destination.origin !== new URL(config.homepage).origin) {
				path = saved.destinationUrl;
			} else {
				const rest =
					destination.pathname + destination.search + destination.hash;
				path = rest === "/" ? "" : rest;
			}
		} catch {
			path = "";
		}
	}
	const domainId =
		saved.domainId &&
		config?.domains.some((entry) => entry.id === saved.domainId)
			? saved.domainId
			: "";
	return { path, domainId };
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export async function copyRichLink(url: string, words: string): Promise<void> {
	const html = `<a href="${escapeHtml(url)}">${escapeHtml(words || url)}</a>`;
	if ("ClipboardItem" in window && navigator.clipboard?.write) {
		await navigator.clipboard.write([
			new ClipboardItem({
				"text/html": new Blob([html], { type: "text/html" }),
				"text/plain": new Blob([url], { type: "text/plain" }),
			}),
		]);
		return;
	}
	await navigator.clipboard.writeText(url);
}

export function LocalLinksBanner() {
	const config = useTrackingConfig();
	if (!config.data?.isLocal) return null;

	return (
		<Alert variant="warning">
			<Icon icon={Warning} />
			<AlertTitle>
				Tracking links only work on the engine's computer.
			</AlertTitle>
			<AlertDescription>
				The links start with {config.data.baseUrl}. People you email cannot open
				them until the Outreach Engine is on the internet. Do not put them in
				real emails yet.
			</AlertDescription>
		</Alert>
	);
}

export function LinkTargetFields({
	value,
	onChange,
	config,
}: {
	value: LinkTarget;
	onChange: (value: LinkTarget) => void;
	config: TrackingConfig | undefined;
}) {
	const pathId = useId();
	const homepage = config?.homepage ?? "";
	let defaultHost = "…";
	try {
		defaultHost = config ? new URL(config.baseUrl).host : "…";
	} catch {
		defaultHost = config?.baseUrl ?? "…";
	}

	return (
		<>
			<Field>
				<FieldLabel htmlFor={pathId}>Link leads to</FieldLabel>
				<div className="flex items-center gap-1 text-xs">
					<span className="shrink-0 text-muted-foreground">
						{homepage || "…"}
					</span>
					<Input
						id={pathId}
						placeholder="/pricing (optional)"
						value={value.path}
						onChange={(event) =>
							onChange({ ...value, path: event.target.value })
						}
					/>
				</div>
				<FieldDescription>
					Leave empty for the homepage, type a page like /pricing, or paste a
					full address on{" "}
					{(config?.allowedHosts ?? []).join(", ") || "an allowed site"}.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel>Sending from</FieldLabel>
				<Select
					value={value.domainId || DEFAULT_DOMAIN}
					onValueChange={(next) =>
						onChange({
							...value,
							domainId: next === DEFAULT_DOMAIN ? "" : next,
						})
					}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={DEFAULT_DOMAIN}>
							Default ({defaultHost})
						</SelectItem>
						{(config?.domains ?? []).map((domain) => (
							<SelectItem key={domain.id} value={domain.id}>
								{domain.name} → {domain.trackingHost}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<FieldDescription>
					The domain of the inbox you send from. Its links use that domain's
					tracking address, so they match the email.
					{config && config.domains.length === 0
						? " No domain has a tracking address yet. Set one in Sending setup → Domains."
						: ""}
				</FieldDescription>
			</Field>
			<p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
				{linkBaseOf(value, config)}/r/
				<span className="text-muted-foreground">abc123…</span> →{" "}
				{destinationOf(value.path, homepage)}
			</p>
		</>
	);
}
