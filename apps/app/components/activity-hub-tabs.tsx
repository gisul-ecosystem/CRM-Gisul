"use client";

import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import Link from "next/link";
import {
	ACTIVITY_HUB,
	type ActivityHubTab,
} from "@/lib/activity-hub/activity-hub-config";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function ActivityHubTabs({ active }: { active: ActivityHubTab }) {
	const workspaceUrl = useWorkspaceUrl();

	return (
		<nav aria-label={ACTIVITY_HUB.title} className="pb-4">
			<Tabs value={active}>
				<TabsList>
					{ACTIVITY_HUB.tabs.map((tab) => (
						<TabsTrigger key={tab.id} value={tab.id} asChild>
							<Link href={workspaceUrl(tab.href)} prefetch>
								{tab.label}
							</Link>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</nav>
	);
}
