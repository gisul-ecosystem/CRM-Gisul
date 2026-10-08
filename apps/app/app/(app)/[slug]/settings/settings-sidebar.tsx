"use client";

import Analytics from "@carbon/icons-react/es/Analytics";
import Apps from "@carbon/icons-react/es/Apps";
import Currency from "@carbon/icons-react/es/Currency";
import Folder from "@carbon/icons-react/es/Folder";
import Key from "@carbon/icons-react/es/Key";
import Security from "@carbon/icons-react/es/Security";
import Settings from "@carbon/icons-react/es/Settings";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import type { CarbonIcon } from "@crm/ui/components/icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import styles from "./settings-design.module.css";

type SettingsNavItem = {
	title: string;
	description: string;
	href: string;
	icon: CarbonIcon;
};

const ROOT = "/settings";

const ITEMS: SettingsNavItem[] = [
	{
		title: "General",
		description: "Company and basic settings",
		href: ROOT,
		icon: Settings,
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
		icon: Folder,
	},
	{
		title: "Integrations",
		description: "Connect with other tools",
		href: `${ROOT}/connections`,
		icon: Apps,
	},
	{
		title: "Tracking",
		description: "Analytics script and domains",
		href: `${ROOT}/tracking`,
		icon: Analytics,
	},
	{
		title: "Currencies",
		description: "Base currency and exchange rates",
		href: `${ROOT}/currencies`,
		icon: Currency,
	},
	{
		title: "API Keys",
		description: "Keys for external access",
		href: `${ROOT}/api-keys`,
		icon: Key,
	},
	{
		title: "SSO",
		description: "Single sign-on providers",
		href: `${ROOT}/sso`,
		icon: Security,
	},
];

function isActive(href: string, root: string, pathname: string): boolean {
	return href === root ? pathname === href : pathname.startsWith(href);
}

function NavLink({
	item,
	active,
	compact = false,
}: {
	item: SettingsNavItem;
	active: boolean;
	compact?: boolean;
}) {
	const Icon = item.icon;

	return (
		<Link
			href={item.href}
			prefetch
			aria-current={active ? "page" : undefined}
			transitionTypes={["nav-lateral"]}
			className={`${styles.navItem}${active ? ` ${styles.navItemOn}` : ""}${compact ? ` ${styles.navItemCompact}` : ""}`}
		>
			<span className={styles.navIcon} aria-hidden="true">
				<Icon size={18} />
			</span>
			<span className={styles.navText}>
				<span className={styles.navTitle}>{item.title}</span>
				{compact ? null : (
					<span className={styles.navDesc}>{item.description}</span>
				)}
			</span>
		</Link>
	);
}

function NavSkeleton({
	item,
	compact = false,
}: {
	item: SettingsNavItem;
	compact?: boolean;
}) {
	const Icon = item.icon;

	return (
		<span
			className={`${styles.navItem}${compact ? ` ${styles.navItemCompact}` : ""}`}
			aria-disabled="true"
		>
			<span className={styles.navIcon} aria-hidden="true">
				<Icon size={18} />
			</span>
			<span className={styles.navText}>
				<span className={styles.navTitle}>{item.title}</span>
				{compact ? null : (
					<span className={styles.navDesc}>{item.description}</span>
				)}
			</span>
		</span>
	);
}

export function SettingsSidebarFallback() {
	return (
		<>
			<aside className={styles.sidebar}>
				<nav
					aria-label="Workspace settings"
					aria-busy="true"
					className={styles.sidebarNav}
				>
					{ITEMS.map((item) => (
						<NavSkeleton key={item.href} item={item} />
					))}
				</nav>
			</aside>

			<nav
				aria-label="Workspace settings"
				aria-busy="true"
				className={styles.mobileNav}
			>
				{ITEMS.map((item) => (
					<NavSkeleton key={item.href} item={item} compact />
				))}
			</nav>
		</>
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
			<aside className={styles.sidebar}>
				<nav aria-label="Workspace settings" className={styles.sidebarNav}>
					{items.map((item) => (
						<NavLink
							key={item.href}
							item={item}
							active={isActive(item.href, root, pathname)}
						/>
					))}
				</nav>
			</aside>

			<nav aria-label="Workspace settings" className={styles.mobileNav}>
				{items.map((item) => (
					<NavLink
						key={item.href}
						item={item}
						active={isActive(item.href, root, pathname)}
						compact
					/>
				))}
			</nav>
		</>
	);
}
