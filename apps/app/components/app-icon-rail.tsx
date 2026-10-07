"use client";

import Activity from "@carbon/icons-react/es/Activity";
import Analytics from "@carbon/icons-react/es/Analytics";
import Building from "@carbon/icons-react/es/Building";
import Close from "@carbon/icons-react/es/Close";
import Home from "@carbon/icons-react/es/Home";
import Partnership from "@carbon/icons-react/es/Partnership";
import Settings from "@carbon/icons-react/es/Settings";
import SidePanelClose from "@carbon/icons-react/es/SidePanelClose";
import SidePanelOpen from "@carbon/icons-react/es/SidePanelOpen";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Button } from "@crm/ui/components/button";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import Bot from "@crm/ui/components/icons/bot";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AgentBuilderSidebar } from "@/components/agent-builder/agent-builder-sidebar";
import { useAppRail } from "@/components/app-rail";
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import { useMobileNav } from "@/components/mobile-nav";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type RailItem = {
	title: string;
	href: string;
	icon: CarbonIcon;
	iconClassName?: string;
	match: "exact" | "prefix";
	related?: string[];
};

type NavGroup = {
	label: string | null;
	items: RailItem[];
};

const TOP_ITEM: RailItem = {
	title: "Dashboard",
	href: "/",
	icon: Home,
	match: "exact",
};

const GROUPS: NavGroup[] = [
	{
		label: "CRM",
		items: [
			{
				title: "Leads",
				href: "/contacts",
				icon: UserMultiple,
				match: "prefix",
			},
			{
				title: "Customers",
				href: "/companies",
				icon: Building,
				match: "prefix",
			},
			{ title: "Deals", href: "/deals", icon: Partnership, match: "prefix" },
		],
	},
	{
		label: "Work",
		items: [
			{
				title: "Activities",
				href: "/activities",
				icon: Activity,
				match: "prefix",
			},
			{
				title: "Chat",
				href: "/chat",
				icon: Bot,
				iconClassName: "size-5",
				match: "prefix",
				related: ["/agents"],
			},
		],
	},
	{
		label: "Insights",
		items: [
			{
				title: "Reports",
				href: "/reports",
				icon: Analytics,
				match: "prefix",
			},
		],
	},
];

const SETTINGS_ITEM: RailItem = {
	title: "Settings",
	href: "/settings",
	icon: Settings,
	match: "prefix",
};

const ALL_ITEMS = [
	TOP_ITEM,
	...GROUPS.flatMap((group) => group.items),
	SETTINGS_ITEM,
];

function isActive(item: RailItem, pathname: string): boolean {
	return (
		pathname === item.href ||
		(item.match === "prefix" && pathname.startsWith(item.href)) ||
		Boolean(item.related?.some((prefix) => pathname.startsWith(prefix)))
	);
}

function NavLink({
	item,
	active,
	onPrefetch,
	onNavigate,
	collapsed = false,
}: {
	item: RailItem;
	active: boolean;
	onPrefetch: () => void;
	onNavigate?: () => void;
	collapsed?: boolean;
}) {
	if (collapsed) {
		return (
			<Button
				asChild
				variant="ghost"
				size="icon"
				className={cn(
					"text-muted-foreground",
					active &&
						"bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
				)}
			>
				<Link
					href={item.href}
					prefetch
					onMouseEnter={onPrefetch}
					onFocus={onPrefetch}
					aria-current={active ? "page" : undefined}
					aria-label={item.title}
					title={item.title}
					onClick={onNavigate}
					transitionTypes={[
						item.title === "Chat" ? "nav-forward" : "nav-lateral",
					]}
				>
					<Icon icon={item.icon} className={item.iconClassName} />
				</Link>
			</Button>
		);
	}

	return (
		<Button
			asChild
			variant="ghost"
			className={cn(
				"h-9 w-full justify-start gap-3 px-3 font-normal text-muted-foreground",
				active &&
					"bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
			)}
		>
			<Link
				href={item.href}
				prefetch
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
				aria-current={active ? "page" : undefined}
				onClick={onNavigate}
				transitionTypes={[
					item.title === "Chat" ? "nav-forward" : "nav-lateral",
				]}
			>
				<Icon icon={item.icon} className={item.iconClassName} />
				<span>{item.title}</span>
			</Link>
		</Button>
	);
}

function SidebarNav({
	pathname,
	resolveHref,
	resolveRelated,
	onPrefetch,
	onNavigate,
	className,
	collapsed = false,
}: {
	pathname: string;
	resolveHref: (href: string) => string;
	resolveRelated: (related?: string[]) => string[] | undefined;
	onPrefetch: (section: string) => void;
	onNavigate?: () => void;
	className?: string;
	collapsed?: boolean;
}) {
	return (
		<nav
			aria-label="Primary"
			className={cn(
				"flex flex-col",
				collapsed ? "items-center gap-1" : "gap-5",
				className,
			)}
		>
			<div
				className={cn(
					"flex flex-col",
					collapsed ? "items-center gap-1" : "gap-1",
				)}
			>
				<NavLink
					item={{
						...TOP_ITEM,
						href: resolveHref(TOP_ITEM.href),
					}}
					active={isActive(
						{
							...TOP_ITEM,
							href: resolveHref(TOP_ITEM.href),
						},
						pathname,
					)}
					onPrefetch={() => onPrefetch(TOP_ITEM.href)}
					onNavigate={onNavigate}
					collapsed={collapsed}
				/>
			</div>

			{GROUPS.map((group) => (
				<div
					key={group.label}
					className={cn(
						"flex flex-col",
						collapsed ? "items-center gap-1" : "gap-1",
					)}
				>
					{group.label && !collapsed ? (
						<p className="px-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
							{group.label}
						</p>
					) : null}
					{collapsed && group.label ? (
						<div className="my-1 h-px w-5 bg-border" aria-hidden="true" />
					) : null}
					{group.items.map((item) => {
						const resolved = {
							...item,
							href: resolveHref(item.href),
							related: resolveRelated(item.related),
						};
						return (
							<NavLink
								key={item.href}
								item={resolved}
								active={isActive(resolved, pathname)}
								onPrefetch={() => onPrefetch(item.href)}
								onNavigate={onNavigate}
								collapsed={collapsed}
							/>
						);
					})}
				</div>
			))}
		</nav>
	);
}

export function AppIconRailFallback() {
	return (
		<aside
			aria-label="Primary"
			aria-busy="true"
			className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex [view-transition-name:app-rail]"
		>
			<div className="flex flex-1 flex-col gap-5 px-2 py-3">
				{ALL_ITEMS.map((item) => (
					<Button
						key={item.href}
						variant="ghost"
						disabled
						className="h-9 w-full justify-start gap-3 px-3 text-muted-foreground"
					>
						<Icon icon={item.icon} className={item.iconClassName} />
						<span>{item.title}</span>
					</Button>
				))}
			</div>
		</aside>
	);
}

export function AppIconRail() {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();
	const { open, setOpen } = useMobileNav();
	const appRail = useAppRail();
	const prefetchSection = usePrefetchSection();

	const resolveHref = useMemo(
		() => (href: string) => workspaceUrl(href),
		[workspaceUrl],
	);
	const resolveRelated = useMemo(
		() => (related?: string[]) => related?.map((path) => workspaceUrl(path)),
		[workspaceUrl],
	);

	const settings = {
		...SETTINGS_ITEM,
		href: resolveHref(SETTINGS_ITEM.href),
	};
	const inChat = ALL_ITEMS.some(
		(item) =>
			item.title === "Chat" &&
			isActive(
				{
					...item,
					href: resolveHref(item.href),
					related: resolveRelated(item.related),
				},
				pathname,
			),
	);

	const railOpen = appRail.open;

	return (
		<>
			<aside
				className={cn(
					"hidden shrink-0 flex-col border-r bg-background md:flex [view-transition-name:app-rail]",
					railOpen ? "w-60" : "w-14",
				)}
				data-rail={railOpen ? "open" : "closed"}
			>
				<div
					className={cn(
						"flex shrink-0 items-center py-2",
						railOpen ? "justify-end px-2" : "justify-center",
					)}
				>
					<Button
						variant="ghost"
						size="icon"
						aria-label={railOpen ? "Close navigation" : "Open navigation"}
						aria-expanded={railOpen}
						onClick={railOpen ? appRail.collapse : appRail.expand}
					>
						<Icon icon={railOpen ? SidePanelClose : SidePanelOpen} />
					</Button>
				</div>

				<div
					className={cn(
						"min-h-0 flex-1 overflow-y-auto py-1",
						railOpen ? "px-2" : "px-1",
					)}
				>
					<SidebarNav
						pathname={pathname}
						resolveHref={resolveHref}
						resolveRelated={resolveRelated}
						onPrefetch={prefetchSection}
						collapsed={!railOpen}
					/>
				</div>

				<div
					className={cn(
						"mt-auto flex flex-col border-t py-2",
						railOpen ? "gap-3 px-2" : "items-center gap-1 px-1",
					)}
				>
					<NavLink
						item={settings}
						active={isActive(settings, pathname)}
						onPrefetch={() => prefetchSection(SETTINGS_ITEM.href)}
						collapsed={!railOpen}
					/>
				</div>
			</aside>

			<Sheet open={open} onOpenChange={setOpen}>
				{inChat ? (
					<SheetContent
						side="left"
						showCloseButton={false}
						className="w-5/6 max-w-sm flex-row gap-0 p-0"
					>
						<SheetHeader className="sr-only">
							<SheetTitle>Navigation and agent chats</SheetTitle>
						</SheetHeader>
						<aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r py-3">
							<Button
								variant="ghost"
								size="icon"
								aria-label="Close navigation"
								onClick={() => setOpen(false)}
							>
								<Icon icon={Close} />
							</Button>
							<div className="my-1 h-px w-5 bg-border" />
							{ALL_ITEMS.map((item) => {
								const resolved = {
									...item,
									href: resolveHref(item.href),
									related: resolveRelated(item.related),
								};
								return (
									<Button
										key={item.href}
										asChild
										variant="ghost"
										size="icon"
										className={cn(
											"text-muted-foreground",
											isActive(resolved, pathname) &&
												"bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
										)}
									>
										<Link
											href={resolved.href}
											prefetch
											onMouseEnter={() => prefetchSection(item.href)}
											onFocus={() => prefetchSection(item.href)}
											aria-current={
												isActive(resolved, pathname) ? "page" : undefined
											}
											onClick={() => setOpen(false)}
										>
											<Icon icon={item.icon} className={item.iconClassName} />
											<span className="sr-only">{item.title}</span>
										</Link>
									</Button>
								);
							})}
						</aside>
						<AgentBuilderSidebar
							className="flex flex-1"
							onNavigate={() => setOpen(false)}
						/>
					</SheetContent>
				) : (
					<SheetContent side="left" className="w-72 gap-0 p-0">
						<SheetHeader className="sr-only">
							<SheetTitle>Navigation</SheetTitle>
						</SheetHeader>
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
							<SidebarNav
								pathname={pathname}
								resolveHref={resolveHref}
								resolveRelated={resolveRelated}
								onPrefetch={prefetchSection}
								onNavigate={() => setOpen(false)}
							/>
							<div className="mt-auto flex flex-col gap-3 border-t pt-3">
								<NavLink
									item={settings}
									active={isActive(settings, pathname)}
									onPrefetch={() => prefetchSection(SETTINGS_ITEM.href)}
									onNavigate={() => setOpen(false)}
								/>
							</div>
						</div>
					</SheetContent>
				)}
			</Sheet>
		</>
	);
}
