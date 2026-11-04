"use client";

import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import ErrorFilled from "@carbon/icons-react/es/ErrorFilled";
import WarningAltFilled from "@carbon/icons-react/es/WarningAltFilled";
import { Button } from "@crm/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { Skeleton } from "@crm/ui/components/skeleton";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import NextLink from "next/link";
import { toast } from "sonner";
import { sendingApi } from "@/lib/outreach/api";
import { useOutreachCache } from "@/lib/outreach/cache";
import { keyed } from "@/lib/outreach/format";
import { crmPathForEnginePage } from "@/lib/outreach/routes";
import type {
	ReadinessFix,
	ReadinessItem,
	ReadinessLevel,
} from "@/lib/outreach/schemas/readiness";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const LEVELS = {
	error: {
		icon: ErrorFilled,
		heading: "Must fix — Start and Resume are blocked until these are fixed",
		iconClass: "text-destructive",
	},
	warning: {
		icon: WarningAltFilled,
		heading: "Warnings — you can still start",
		iconClass: "text-warning",
	},
	ok: {
		icon: CheckmarkFilled,
		heading: "Passed",
		iconClass: "text-success",
	},
} as const satisfies Record<
	ReadinessLevel,
	{ icon: CarbonIcon; heading: string; iconClass: string }
>;

export function readinessSummary(items: ReadinessItem[]) {
	const groups = new Map<string, ReadinessLevel[]>();
	for (const item of items) {
		const key = `${item.check}:${item.template ?? "-"}`;
		groups.set(key, [...(groups.get(key) ?? []), item.level]);
	}
	const rules = [...groups.values()];
	return {
		total: rules.length,
		passed: rules.filter((levels) => levels.every((level) => level === "ok"))
			.length,
		errors: items.filter((item) => item.level === "error").length,
		warnings: items.filter((item) => item.level === "warning").length,
	};
}

export function ReadinessPanel({
	items,
	versionNames,
	loading = false,
	title,
	onFix,
	onSendTest,
	onEditEmail,
}: {
	items: ReadinessItem[];
	versionNames?: string[];
	loading?: boolean;
	title: string;
	onFix?: (item: ReadinessItem, fix: ReadinessFix) => void;
	onSendTest?: () => void;
	onEditEmail?: () => void;
}) {
	const summary = readinessSummary(items);
	const emailProblem = items.some(
		(item) => item.level !== "ok" && item.template !== undefined,
	);
	const passed = items.filter((item) => item.level === "ok");

	return (
		<section
			aria-label={title}
			className="flex flex-col gap-3 rounded-lg border p-4 text-xs"
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="flex flex-col gap-0.5">
					<h3 className="font-medium text-sm">{title}</h3>
					{loading ? (
						<Skeleton className="h-4 w-40" />
					) : (
						<p className="text-muted-foreground" aria-live="polite">
							{summary.passed} of {summary.total} checks passed
							{summary.errors ? ` · ${summary.errors} must fix` : ""}
							{summary.warnings
								? ` · ${summary.warnings} warning${summary.warnings === 1 ? "" : "s"}`
								: ""}
						</p>
					)}
				</div>
				{onEditEmail && emailProblem ? (
					<Button variant="outline" size="sm" onClick={onEditEmail}>
						Edit the email
					</Button>
				) : null}
			</div>

			{(["error", "warning"] as const).map((level) => {
				const list = items.filter((item) => item.level === level);
				if (list.length === 0) return null;
				return (
					<div
						key={level}
						className={cn(
							"flex flex-col gap-2 rounded-lg border p-3",
							level === "error" ? "border-destructive/40" : "border-warning",
						)}
					>
						<span className="font-medium text-muted-foreground uppercase tracking-wide">
							{LEVELS[level].heading}
						</span>
						<ul className="flex flex-col gap-2">
							{list.map((item) => (
								<ReadinessRow
									key={item.key}
									item={item}
									versionNames={versionNames}
									onFix={onFix}
									onSendTest={onSendTest}
								/>
							))}
						</ul>
					</div>
				);
			})}

			{passed.length > 0 ? (
				<Collapsible>
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="self-start">
							{passed.length} passed check{passed.length === 1 ? "" : "s"}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
							{passed.map((item) => (
								<ReadinessRow
									key={item.key}
									item={item}
									versionNames={versionNames}
								/>
							))}
						</ul>
					</CollapsibleContent>
				</Collapsible>
			) : null}
		</section>
	);
}

function ReadinessRow({
	item,
	versionNames,
	onFix,
	onSendTest,
}: {
	item: ReadinessItem;
	versionNames?: string[];
	onFix?: (item: ReadinessItem, fix: ReadinessFix) => void;
	onSendTest?: () => void;
}) {
	const level = LEVELS[item.level];
	const version =
		versionNames && versionNames.length > 1 && item.template !== undefined
			? versionNames[item.template] || `Version ${item.template + 1}`
			: null;

	return (
		<li className="flex gap-2">
			<Icon
				icon={level.icon}
				className={cn("mt-0.5 shrink-0", level.iconClass)}
				aria-hidden
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<span>
					{version ? <span className="font-medium">{version}: </span> : null}
					{item.message}
				</span>
				{item.level !== "ok" && item.fixes?.length ? (
					<div className="flex flex-wrap gap-1.5">
						{keyed(item.fixes, item.key).map(({ id, item: fix }) => (
							<FixButton
								key={id}
								item={item}
								fix={fix}
								onFix={onFix}
								onSendTest={onSendTest}
							/>
						))}
					</div>
				) : null}
			</div>
		</li>
	);
}

function FixButton({
	item,
	fix,
	onFix,
	onSendTest,
}: {
	item: ReadinessItem;
	fix: ReadinessFix;
	onFix?: (item: ReadinessItem, fix: ReadinessFix) => void;
	onSendTest?: () => void;
}) {
	const href = useWorkspaceUrl();

	switch (fix.kind) {
		case "insert":
		case "replace":
			return onFix ? (
				<Button variant="outline" size="xs" onClick={() => onFix(item, fix)}>
					{fix.label}
				</Button>
			) : null;
		case "show":
			return onFix ? (
				<Button variant="ghost" size="xs" onClick={() => onFix(item, fix)}>
					Show me
				</Button>
			) : null;
		case "link":
			return (
				<Button asChild variant="outline" size="xs">
					<NextLink href={href(crmPathForEnginePage(fix.href))}>
						{fix.label}
					</NextLink>
				</Button>
			);
		case "send-test":
			return onSendTest ? (
				<Button variant="outline" size="xs" onClick={onSendTest}>
					Send test to myself
				</Button>
			) : null;
		case "recheck-dns":
			return <RecheckDnsButton domainId={fix.domainId} />;
	}
}

function RecheckDnsButton({ domainId }: { domainId: string }) {
	const cache = useOutreachCache();
	const recheck = useMutation({
		mutationFn: () => sendingApi.checkDns(domainId),
		onSuccess: async (domain) => {
			await Promise.all([cache.sending(), cache.campaigns()]);
			toast.success(`DNS re-checked for ${domain.name}.`);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Button
			variant="outline"
			size="xs"
			disabled={recheck.isPending}
			onClick={() => recheck.mutate()}
		>
			{recheck.isPending ? "Checking…" : "Re-check DNS"}
		</Button>
	);
}
