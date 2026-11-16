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
import { accountsApi } from "@/lib/unifers/api";
import { unifersKeys } from "@/lib/unifers/cache";
import { UnifersError } from "@/lib/unifers/client";

const UNAVAILABLE = new Map<string, { title: string; description: string }>(
	Object.entries({
		UNIFERS_NOT_CONFIGURED: {
			title: "Unifers is not connected",
			description:
				"Set UNIFERS_API_KEY in the CRM's .env, then restart the CRM. Engine campaigns still work.",
		},
		UNIFERS_UNREACHABLE: {
			title: "Unifers is not answering",
			description: "The CRM could not reach api.unifers.ai. Try again shortly.",
		},
		API_ACCESS_NOT_IN_PLAN: {
			title: "Your Unifers plan has no API access",
			description: "Upgrade the Unifers plan to use it from the CRM.",
		},
	}),
);

export function useUnifersHealth() {
	return useQuery({
		queryKey: unifersKeys.accounts,
		queryFn: () => accountsApi.list(),
		retry: false,
		staleTime: 60_000,
	});
}

export function UnifersPage({
	title,
	description,
	actions,
	lead,
	children,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	lead?: ReactNode;
	children: ReactNode;
}) {
	const health = useUnifersHealth();

	const problem = health.error
		? health.error instanceof UnifersError
			? (UNAVAILABLE.get(health.error.code) ?? {
					title: "Unifers is unavailable",
					description: health.error.message,
				})
			: { title: "Unifers is unavailable", description: health.error.message }
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
				{actions ? <PageShellActions>{actions}</PageShellActions> : null}
			</PageShellHeader>
			<PageShellContent>
				{lead}
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
