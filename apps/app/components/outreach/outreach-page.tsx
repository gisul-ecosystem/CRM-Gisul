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
import { useQuery } from "@tanstack/react-query";
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
import { healthApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { OutreachError } from "@/lib/outreach/client";

const UNAVAILABLE = new Map<string, { title: string; description: string }>(
	Object.entries({
		OUTREACH_NOT_CONFIGURED: {
			title: "Outreach is not connected",
			description:
				"Set OUTREACH_URL, OUTREACH_EMAIL and OUTREACH_PASSWORD in the CRM's .env, then restart the CRM.",
		},
		OUTREACH_UNREACHABLE: {
			title: "The Outreach service is not answering",
			description:
				"The CRM is configured, but the Outreach Engine did not respond. Check that its web service is running.",
		},
		OUTREACH_LOGIN_FAILED: {
			title: "Outreach refused the CRM",
			description:
				"The Outreach Engine rejected the CRM's login. Check OUTREACH_EMAIL and OUTREACH_PASSWORD against an Outreach admin account.",
		},
	}),
);

export function OutreachPage({
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
	const health = useQuery({
		queryKey: [...outreachKeys.all, "health"],
		queryFn: () => healthApi.check(),
		retry: false,
		staleTime: 60_000,
	});

	const problem =
		health.error instanceof OutreachError
			? (UNAVAILABLE.get(health.error.code) ?? {
					title: "Outreach is unavailable",
					description: health.error.message,
				})
			: health.error
				? {
						title: "Outreach is unavailable",
						description: health.error.message,
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
				{health.isPending ? (
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
