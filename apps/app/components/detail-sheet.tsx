"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Close from "@carbon/icons-react/es/Close";
import { Button } from "@crm/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import { Separator } from "@crm/ui/components/separator";
import type { SheetSize } from "@crm/ui/components/sheet";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import { type ReactNode, useRef, useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/responsive-sheet";
import styles from "@/components/crm/record-sheet/record-sheet-design.module.css";

export const SECTION_TITLE = styles.sectionTitle;

export const PROPERTY_ROW = styles.property;

export const PROPERTY_LABEL = styles.propertyLabel;

export function DetailSheet({
	open,
	onOpenChange,
	size = "2xl",
	className,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	size?: SheetSize;
	className?: string;
	children: ReactNode;
}) {
	const content = useRef<HTMLDivElement>(null);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				ref={content}
				side="right"
				size={size}
				showCloseButton={false}
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					content.current?.focus();
				}}
				className={cn("flex flex-col gap-0 p-0", styles.shell, className)}
			>
				{children}
			</SheetContent>
		</Sheet>
	);
}

export function DetailSheetHeader({
	media,
	title,
	description,
	note,
	actions,
	onBack,
	onClose,
}: {
	media?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	note?: ReactNode;
	actions?: ReactNode;
	onBack?: () => void;
	onClose: () => void;
}) {
	return (
		<SheetHeader className={styles.header}>
			<div className={styles.headerRow}>
				{onBack ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon-sm" onClick={onBack}>
								<Icon icon={ArrowLeft} />
								<span className="sr-only">Back</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Back</TooltipContent>
					</Tooltip>
				) : null}

				{media}

				<div className={styles.headerText}>
					<SheetTitle className={styles.title}>{title}</SheetTitle>
					{description ? (
						<SheetDescription className={styles.description}>
							{description}
						</SheetDescription>
					) : null}
					{note ? <div className={styles.note}>{note}</div> : null}
				</div>

				<div className={styles.actions}>
					{actions}
					{actions ? (
						<Separator orientation="vertical" className="mx-0.5 h-5" />
					) : null}
					<Button variant="ghost" size="icon-sm" onClick={onClose}>
						<Icon icon={Close} />
						<span className="sr-only">Close</span>
					</Button>
				</div>
			</div>
		</SheetHeader>
	);
}

export function DetailSheetStats({ children }: { children: ReactNode }) {
	return <dl className={styles.stats}>{children}</dl>;
}

export function DetailSheetStat({
	label,
	children,
}: {
	label: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className={styles.stat}>
			<dt className={styles.statLabel}>{label}</dt>
			<dd className={styles.statValue}>{children}</dd>
		</div>
	);
}

export type DetailSheetTab = {
	value: string;
	label: string;
	count?: number | null;
	content: ReactNode;
	keepMounted?: boolean;
};

export function DetailSheetTabs({
	tabs,
	value,
	onValueChange,
}: {
	tabs: DetailSheetTab[];
	value: string;
	onValueChange: (value: string) => void;
}) {
	const [opened] = useState(() => new Set<string>());
	opened.add(value);

	return (
		<Tabs
			value={value}
			onValueChange={onValueChange}
			className="flex min-h-0 flex-1 flex-col gap-0"
		>
			<TabsList variant="line" className={styles.tabs}>
				{tabs.map((tab) => (
					<TabsTrigger key={tab.value} value={tab.value} className={styles.tab}>
						{tab.label}
						{tab.count != null && tab.count > 0 ? (
							<span className={styles.tabCount}>{tab.count}</span>
						) : null}
					</TabsTrigger>
				))}
			</TabsList>

			{tabs.map((tab) => (
				<TabsContent
					key={tab.value}
					value={tab.value}
					forceMount={
						tab.keepMounted && opened.has(tab.value) ? true : undefined
					}
					className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[state=inactive]:hidden"
				>
					{tab.content}
				</TabsContent>
			))}
		</Tabs>
	);
}

export function DetailSheetBody({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			{children}
		</div>
	);
}

export function DetailSheetSection({
	title,
	action,
	className,
	children,
}: {
	title?: ReactNode;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section className={cn(styles.section, className)}>
			{title || action ? (
				<div className={styles.sectionHead}>
					{title ? <h3 className={styles.sectionTitle}>{title}</h3> : <span />}
					{action}
				</div>
			) : null}
			{children}
		</section>
	);
}

export function DetailSheetSplit({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
			{children}
		</div>
	);
}

export function DetailSheetMain({ children }: { children: ReactNode }) {
	return <div className="flex min-w-0 flex-1 flex-col">{children}</div>;
}

export function DetailSheetRail({ children }: { children: ReactNode }) {
	return (
		<div className="flex w-full min-w-0 shrink-0 flex-col lg:w-80">
			{children}
		</div>
	);
}

export function DetailSheetProperties({
	children,
	columns = 2,
}: {
	children: ReactNode;
	columns?: 1 | 2;
}) {
	return (
		<div
			className={cn(styles.properties, columns === 2 && styles.propertiesTwo)}
		>
			{children}
		</div>
	);
}

export function DetailSheetPending({
	fields,
	running,
}: {
	fields: string[];
	running: boolean;
}) {
	if (fields.length === 0) return null;

	return (
		<div className="flex flex-col gap-1.5 rounded-md bg-[var(--brand-soft)] p-3">
			<div className="flex items-center gap-2">
				<span
					aria-hidden
					className={cn(
						"size-1.5 shrink-0 rounded-full",
						running ? "bg-[var(--brand)]" : "bg-[var(--text-muted)]",
					)}
				/>
				<span className="font-medium text-xs text-[var(--ink)]">
					{running ? "Agent is researching" : "Not known yet"}
				</span>
			</div>
			<p className="text-pretty text-[color:var(--text-muted)] text-xs/5">
				{fields.join(", ")}
			</p>
		</div>
	);
}

export function DetailSheetProperty({
	label,
	wide = false,
	children,
}: {
	label: ReactNode;
	wide?: boolean;
	children: ReactNode;
}) {
	return (
		<div className={cn(styles.property, wide && styles.propertyWide)}>
			<span className={styles.propertyLabel}>{label}</span>
			<div className={styles.propertyValue}>{children}</div>
		</div>
	);
}

export function DetailSheetProse({ children }: { children: ReactNode }) {
	return <p className={styles.prose}>{children}</p>;
}

export function DetailSheetEmpty({
	icon,
	title,
	description,
	action,
}: {
	icon: CarbonIcon;
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<Empty className={styles.empty}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon icon={icon} />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{action ? <EmptyContent>{action}</EmptyContent> : null}
		</Empty>
	);
}
