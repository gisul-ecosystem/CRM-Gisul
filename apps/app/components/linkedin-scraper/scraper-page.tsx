"use client";

import Plug from "@carbon/icons-react/es/Plug";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import type { ReactNode } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { ScraperError } from "@/lib/linkedin-scraper/client";
import { useScraperStatus } from "@/lib/linkedin-scraper/use-status";

const UNAVAILABLE = new Map<string, { title: string; description: string }>(
	Object.entries({
		SCRAPER_NOT_CONFIGURED: {
			title: "The LinkedIn scraper is not connected",
			description:
				"Set LINKEDIN_SCRAPER_URL in the CRM's .env, then restart the CRM.",
		},
		SCRAPER_UNREACHABLE: {
			title: "The LinkedIn scraper is not answering",
			description:
				"The CRM is configured, but the scraper did not respond. Check that its service is running.",
		},
	}),
);

export function ScraperPage({
	title,
	description,
	actions,
	children,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}) {
	const status = useScraperStatus();

	const problem =
		status.error instanceof ScraperError
			? (UNAVAILABLE.get(status.error.code) ?? {
					title: "The LinkedIn scraper is unavailable",
					description: status.error.message,
				})
			: status.error
				? {
						title: "The LinkedIn scraper is unavailable",
						description: status.error.message,
					}
				: null;

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{title}</PageShellTitle>
					{description ? (
						<PageShellDescription>{description}</PageShellDescription>
					) : null}
				</PageShellHeading>
				{actions && !problem ? (
					<PageShellActions>{actions}</PageShellActions>
				) : null}
			</PageShellHeader>
			<PageShellContent>
				{status.isPending ? (
					<PageShellLoading />
				) : problem ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Icon icon={Plug} />
							</EmptyMedia>
							<EmptyTitle>{problem.title}</EmptyTitle>
							<EmptyDescription>{problem.description}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					children
				)}
			</PageShellContent>
		</PageShell>
	);
}
