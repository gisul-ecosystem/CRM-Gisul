"use client";

import Earth from "@carbon/icons-react/es/Earth";
import LogoLinkedin from "@carbon/icons-react/es/LogoLinkedin";
import { Icon } from "@crm/ui/components/icon";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";

export type LeadHubSource = "website" | "linkedin";

const SOURCE_ICON = { website: Earth, linkedin: LogoLinkedin } as const;

export type LeadHubTab = {
	value: string;
	label: string;
	count?: ReactNode;
	source?: LeadHubSource;
	description: string;
	content: ReactNode;
};

export function LeadHubPage({
	title,
	tabs,
}: {
	title: string;
	tabs: LeadHubTab[];
}) {
	const values = tabs.map((tab) => tab.value);
	const [view, setView] = useQueryState(
		LEAD_HUB.viewParam,
		parseAsStringLiteral(values).withDefault(values[0] ?? ""),
	);
	const current = tabs.find((tab) => tab.value === view) ?? tabs[0];

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{title}</PageShellTitle>
					{current ? (
						<PageShellDescription>{current.description}</PageShellDescription>
					) : null}
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Tabs
					value={current?.value}
					onValueChange={(next) => void setView(next)}
				>
					{tabs.length > 1 ? (
						<TabsList variant="line">
							{tabs.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{tab.source ? (
										<Icon
											icon={SOURCE_ICON[tab.source]}
											data-icon="inline-start"
										/>
									) : null}
									{tab.label}
									{tab.count}
								</TabsTrigger>
							))}
						</TabsList>
					) : null}
					{tabs.map((tab) => (
						<TabsContent key={tab.value} value={tab.value}>
							<div className={tabs.length > 1 ? "pt-4" : undefined}>
								{tab.content}
							</div>
						</TabsContent>
					))}
				</Tabs>
			</PageShellContent>
		</PageShell>
	);
}
