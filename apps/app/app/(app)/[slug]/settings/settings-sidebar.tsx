"use client";

import Analytics from "@carbon/icons-react/es/Analytics";
import CalendarSettings from "@carbon/icons-react/es/CalendarSettings";
import CloudUpload from "@carbon/icons-react/es/CloudUpload";
import Connect from "@carbon/icons-react/es/Connect";
import Currency from "@carbon/icons-react/es/Currency";
import Filter from "@carbon/icons-react/es/Filter";
import Password from "@carbon/icons-react/es/Password";
import Product from "@carbon/icons-react/es/Product";
import Security from "@carbon/icons-react/es/Security";
import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import UserFollow from "@carbon/icons-react/es/UserFollow";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, useMemo } from "react";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type SettingsNavItem = {
	title: string;
	description: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
};

const ROOT = "/settings";

const ITEMS: SettingsNavItem[] = [
	{
		title: "General",
		description: "Company and basic settings",
		href: ROOT,
		icon: SettingsAdjust,
	},
	{
		title: "Users & Teams",
		description: "Manage team members and roles",
		href: `${ROOT}/members`,
		icon: UserMultiple,
	},
	{
		title: "Products",
		description: "Manage your products and services",
		href: `${ROOT}/products`,
		icon: Product,
	},
	{
		title: "Deal Pipeline",
		description: "Customize deal stages",
		href: `${ROOT}/deal-pipeline`,
		icon: Filter,
	},
	{
		title: "Lead Settings",
		description: "Configure lead sources and fields",
		href: `${ROOT}/lead-settings`,
		icon: UserFollow,
	},
	{
		title: "Activity Settings",
		description: "Manage activity types and reminders",
		href: `${ROOT}/activity-settings`,
		icon: CalendarSettings,
	},
	{
		title: "Integrations",
		description: "Connect with other tools",
		href: `${ROOT}/connections`,
		icon: Connect,
	},
	{
		title: "Data Management",
		description: "Import, export and backup",
		href: `${ROOT}/data-management`,
		icon: CloudUpload,
	},
	{
		title: "Currencies",
		description: "Reporting and exchange rates",
		href: `${ROOT}/currencies`,
		icon: Currency,
	},
	{
		title: "API Keys",
		description: "API tokens and credentials",
		href: `${ROOT}/api-keys`,
		icon: Password,
	},
	{
		title: "SSO",
		description: "Single sign-on providers",
		href: `${ROOT}/sso`,
		icon: Security,
	},
	{
		title: "Tracking & Analytics",
		description: "Visitor and domain analytics",
		href: `${ROOT}/tracking`,
		icon: Analytics,
	},
];

function isActive(href: string, root: string, pathname: string): boolean {
	return href === root ? pathname === href : pathname.startsWith(href);
}

function NavLink({
	item,
	active,
	className,
}: {
	item: SettingsNavItem;
	active: boolean;
	className?: string;
}) {
	const ItemIcon = item.icon;

	return (
		<Link
			href={item.href}
			prefetch
			aria-current={active ? "page" : undefined}
			transitionTypes={["nav-lateral"]}
			className={cn(
				"group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150 select-none",
				active
					? "bg-[#5e3da8] text-white shadow-xs"
					: "text-[#626875] hover:bg-[#f4f6fa] hover:text-[#181a20] dark:text-[#9aa0ae] dark:hover:bg-[#1d1f25] dark:hover:text-white",
				className,
			)}
		>
			{/* Compact icon box */}
			<div
				className={cn(
					"flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
					active
						? "bg-white/20 text-white"
						: "bg-[#eff1f5] text-[#555d6e] group-hover:bg-[#e4e8f0] group-hover:text-[#181a20] dark:bg-[#1e2027] dark:text-[#a0a6b5] dark:group-hover:bg-[#282b34]",
				)}
			>
				<Icon icon={ItemIcon} className="h-4 w-4" />
			</div>

			{/* Label & Description */}
			<div className="flex min-w-0 flex-1 flex-col justify-center">
				<span
					className={cn(
						"truncate text-xs font-semibold leading-tight tracking-tight",
						active ? "text-white" : "text-[#181a20] dark:text-[#f0f2f5]",
					)}
				>
					{item.title}
				</span>
				<span
					className={cn(
						"truncate text-[10px] leading-tight",
						active
							? "text-[#e2d8fa]"
							: "text-[#878d9b] dark:text-[#888e9d]",
					)}
				>
					{item.description}
				</span>
			</div>
		</Link>
	);
}

export function SettingsSidebarFallback() {
	return (
		<aside className="hidden w-64 shrink-0 border-r border-[#eaecf2] bg-white p-3 md:flex md:flex-col h-full overflow-y-auto dark:border-[#202228] dark:bg-[#101114] [view-transition-name:settings-sidebar]">
			{/* Top Sidebar Heading matching Figma */}
			<div className="px-2 pt-2 pb-4 select-none">
				<h2 className="text-sm font-black tracking-wider text-[#181a20] uppercase dark:text-[#f0f2f5]">
					SETTINGS
				</h2>
				<p className="text-[11px] text-[#878d9b] mt-0.5 leading-tight dark:text-[#9aa0ae]">
					Manage your account, team and CRM preferences.
				</p>
			</div>
			<nav aria-label="Workspace settings" aria-busy="true" className="flex flex-col gap-1">
				{ITEMS.map((item) => (
					<div
						key={item.href}
						className="flex items-center gap-2.5 rounded-xl p-2 opacity-60"
					>
						<div className="h-7 w-7 shrink-0 rounded-lg bg-muted" />
						<div className="flex flex-col gap-1">
							<div className="h-3 w-20 rounded bg-muted" />
							<div className="h-2 w-28 rounded bg-muted/60" />
						</div>
					</div>
				))}
			</nav>
		</aside>
	);
}

export function SettingsSidebar() {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();

	const root = workspaceUrl(ROOT);
	const items = useMemo(
		() => ITEMS.map((item) => ({ ...item, href: workspaceUrl(item.href) })),
		[workspaceUrl],
	);

	return (
		<>
			{/* Compact Desktop Sidebar */}
			<aside className="hidden w-64 shrink-0 border-r border-[#eaecf2] bg-white p-3 md:flex md:flex-col h-full overflow-y-auto dark:border-[#202228] dark:bg-[#101114] [view-transition-name:settings-sidebar]">
				{/* Top Sidebar Heading matching Figma */}
				<div className="px-2 pt-2 pb-4 select-none">
					<h2 className="text-sm font-black tracking-wider text-[#181a20] uppercase dark:text-[#f0f2f5]">
						SETTINGS
					</h2>
					<p className="text-[11px] text-[#878d9b] mt-0.5 leading-tight dark:text-[#9aa0ae]">
						Manage your account, team and CRM preferences.
					</p>
				</div>

				<nav
					aria-label="Workspace settings"
					className="flex flex-col gap-0.5"
				>
					{items.map((item) => (
						<NavLink
							key={item.href}
							item={item}
							active={isActive(item.href, root, pathname)}
						/>
					))}
				</nav>
			</aside>

			{/* Mobile Scrollable Tabs */}
			<nav
				aria-label="Workspace settings"
				className="flex gap-1.5 overflow-x-auto border-b border-[#eaecf2] bg-white p-2 md:hidden dark:border-[#202228] dark:bg-[#101114] [view-transition-name:settings-sidebar]"
			>
				{items.map((item) => {
					const ItemIcon = item.icon;
					const active = isActive(item.href, root, pathname);
					return (
						<Link
							key={item.href}
							href={item.href}
							prefetch
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
								active
									? "bg-[#5e3da8] text-white shadow-xs"
									: "bg-[#f1f3f7] text-[#555d6e] hover:bg-[#e4e8f0] hover:text-[#181a20] dark:bg-[#1c1e24] dark:text-[#a0a6b5]",
							)}
						>
							<Icon icon={ItemIcon} className="h-3.5 w-3.5" />
							<span>{item.title}</span>
						</Link>
					);
				})}
			</nav>
		</>
	);
}
