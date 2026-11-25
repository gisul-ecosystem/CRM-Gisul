"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { ReactNode } from "react";

export function UrlTabs<T extends string>({
	tabs,
	labels,
	children,
}: {
	tabs: readonly [T, ...T[]];
	labels: Record<T, string>;
	children: Record<T, ReactNode>;
}) {
	const [tab, setTab] = useQueryState(
		"tab",
		parseAsStringLiteral(tabs).withDefault(tabs[0]),
	);

	return (
		<Tabs
			value={tab}
			onValueChange={(next) => {
				const match = tabs.find((candidate) => candidate === next);
				if (match) void setTab(match);
			}}
			className="gap-4"
		>
			<TabsList>
				{tabs.map((value) => (
					<TabsTrigger key={value} value={value}>
						{labels[value]}
					</TabsTrigger>
				))}
			</TabsList>
			{tabs.map((value) => (
				<TabsContent key={value} value={value}>
					{tab === value ? children[value] : null}
				</TabsContent>
			))}
		</Tabs>
	);
}
