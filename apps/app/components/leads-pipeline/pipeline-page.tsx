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
import { TabCount } from "@/components/lead-hub/tab-counts";
import { PageShellLoading } from "@/components/page-shell";
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

type Problem = { title: string; description: string };

function problemFor(error: Error | null): Problem | null {
	if (!error) return null;
	const fallback = {
		title: "The lead generation pipeline is unavailable",
		description: error.message,
	};
	return error instanceof PipelineError
		? (UNAVAILABLE.get(error.code) ?? fallback)
		: fallback;
}

export function PipelineProblem({ error }: { error: Error }) {
	const problem = problemFor(error);
	return <ProblemNotice problem={problem} />;
}

function ProblemNotice({ problem }: { problem: Problem | null }) {
	return (
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
	);
}

export function PipelineGate({
	children,
}: {
	children: (profile: ProfileStatus) => ReactNode;
}) {
	const status = usePipelineStatus();
	const [profile, setProfile] = useLeadProfile();

	const problem = problemFor(status.error);

	const profiles = status.data?.profiles ?? [];
	const current =
		profiles.find((entry) => entry.profile === profile) ?? profiles[0];

	if (status.isPending) return <PageShellLoading />;
	if (problem || !current) {
		return <ProblemNotice problem={problem} />;
	}

	return (
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
							<TabCount value={entry.summary.companies} />
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{children(current)}
		</div>
	);
}
