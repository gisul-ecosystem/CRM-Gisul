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
import { PRODUCT_LABEL } from "@/lib/leads-pipeline/labels";
import {
	type LeadProduct,
	leadProduct,
	leadProfile,
	type ProfileStatus,
} from "@/lib/leads-pipeline/schemas";
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

	const products = [...new Set(profiles.map((entry) => entry.product))];
	const inProduct = profiles.filter(
		(entry) => entry.product === current.product,
	);
	const companiesIn = (product: LeadProduct) =>
		profiles
			.filter((entry) => entry.product === product)
			.reduce((total, entry) => total + entry.summary.companies, 0);

	return (
		<div className="flex flex-col gap-4">
			{products.length > 1 ? (
				<Tabs
					value={current.product}
					onValueChange={(next) => {
						const parsed = leadProduct.safeParse(next);
						const first = profiles.find(
							(entry) => parsed.success && entry.product === parsed.data,
						);
						if (first) void setProfile(first.profile);
					}}
				>
					<TabsList variant="line">
						{products.map((product) => (
							<TabsTrigger key={product} value={product}>
								{PRODUCT_LABEL[product]}
								<TabCount value={companiesIn(product)} />
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			) : null}
			{inProduct.length > 1 ? (
				<Tabs
					value={current.profile}
					onValueChange={(next) => {
						const parsed = leadProfile.safeParse(next);
						if (parsed.success) void setProfile(parsed.data);
					}}
				>
					<TabsList>
						{inProduct.map((entry) => (
							<TabsTrigger key={entry.profile} value={entry.profile}>
								{entry.label}
								<TabCount value={entry.summary.companies} />
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			) : null}
			<div className="pt-2">{children(current)}</div>
		</div>
	);
}
