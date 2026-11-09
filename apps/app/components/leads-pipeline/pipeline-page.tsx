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
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
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
import { PipelineError } from "@/lib/leads-pipeline/client";
import { leadProfile, type ProfileStatus } from "@/lib/leads-pipeline/schemas";
import {
	useLeadProfile,
	usePipelineStatus,
} from "@/lib/leads-pipeline/use-status";

const UNAVAILABLE = new Map<string, { title: string; description: string }>(
	Object.entries({
		PIPELINE_NOT_CONFIGURED: {
			title: "The lead generation pipeline is not connected",
			description:
				"Set LEADS_PIPELINE_URL in the CRM's .env, then restart the CRM.",
		},
		PIPELINE_UNREACHABLE: {
			title: "The lead generation pipeline is not answering",
			description:
				"The CRM is configured, but the pipeline did not respond. Check that its service is running.",
		},
	}),
);

export function PipelinePage({
	title,
	description,
	actions,
	children,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	children: (profile: ProfileStatus) => ReactNode;
}) {
	const status = usePipelineStatus();
	const [profile, setProfile] = useLeadProfile();

	const problem = status.error
		? status.error instanceof PipelineError
			? (UNAVAILABLE.get(status.error.code) ?? {
					title: "The lead generation pipeline is unavailable",
					description: status.error.message,
				})
			: {
					title: "The lead generation pipeline is unavailable",
					description: status.error.message,
				}
		: null;

	const profiles = status.data?.profiles ?? [];
	const current =
		profiles.find((entry) => entry.profile === profile) ?? profiles[0];

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
				) : problem || !current ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Icon icon={Plug} />
							</EmptyMedia>
							<EmptyTitle>
								{problem?.title ?? "The pipeline has no profiles"}
							</EmptyTitle>
							<EmptyDescription>
								{problem?.description ??
									"The pipeline answered, but it lists no lead profiles."}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="flex flex-col gap-6">
						<Tabs
							value={current.profile}
							onValueChange={(next) => {
								const parsed = leadProfile.safeParse(next);
								if (parsed.success) void setProfile(parsed.data);
							}}
						>
							<TabsList>
								{profiles.map((entry) => (
									<TabsTrigger key={entry.profile} value={entry.profile}>
										{entry.label}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
						{children(current)}
					</div>
				)}
			</PageShellContent>
		</PageShell>
	);
}
