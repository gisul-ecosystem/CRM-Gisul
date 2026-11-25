"use client";

import Warning from "@carbon/icons-react/es/Warning";
import { Card } from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatCard } from "@crm/ui/components/stat-card";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { CampaignTestSendDialog } from "@/components/outreach/campaign-test-send-dialog";
import { ReadinessPanel } from "@/components/outreach/readiness-panel";
import { campaignApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { COUNT, DATE_ONLY } from "@/lib/outreach/format";
import { windowSummary } from "@/lib/outreach/labels";
import type { CampaignStats } from "@/lib/outreach/schemas/campaign";
import {
	versionLabel,
	versionsOf,
	type WizardForm,
} from "@/lib/outreach/wizard";

const REVIEW_CARDS = [
	"contacts",
	"sendable",
	"skipped",
	"capacity",
	"finish",
	"window",
] as const;

export function StepReview({
	campaignId,
	listName,
	form,
	stats,
	viewerEmail,
	onEditEmail,
}: {
	campaignId: string;
	listName: string | null;
	form: WizardForm;
	stats: CampaignStats | undefined;
	viewerEmail: string;
	onEditEmail: () => void;
}) {
	const [testOpen, setTestOpen] = useState(false);
	const readiness = useQuery({
		queryKey: [...outreachKeys.campaign(campaignId), "readiness"],
		queryFn: () => campaignApi.readiness(campaignId),
	});
	const versions = versionsOf(form);

	if (!stats) {
		return (
			<div className="grid gap-3 sm:grid-cols-3">
				{REVIEW_CARDS.map((card) => (
					<Skeleton key={card} className="h-20 rounded-lg" />
				))}
			</div>
		);
	}

	const isDraft = stats.status === "draft";
	const days =
		stats.dailyCapacity > 0
			? Math.ceil(stats.remaining / stats.dailyCapacity)
			: null;

	return (
		<div className="flex flex-col gap-5">
			<Card>
				<div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x">
					<StatCard
						label="Contacts in list"
						value={COUNT.format(stats.audience.total)}
						description={listName ?? undefined}
					/>
					<StatCard
						label={isDraft ? "Will get an email" : "Still to send"}
						value={COUNT.format(
							isDraft ? stats.audience.sendable : stats.remaining,
						)}
					/>
					<StatCard
						label="Skipped"
						value={COUNT.format(stats.audience.skipped)}
						description="Unsubscribed, bounced or on the suppression list."
					/>
					<StatCard
						label="Daily capacity"
						value={`${COUNT.format(stats.dailyCapacity)}/day`}
						description={`${stats.usableInboxes} active inbox${stats.usableInboxes === 1 ? "" : "es"}`}
					/>
					<StatCard
						label="Estimated finish"
						value={
							stats.eta ? (
								<LocalDateTime date={stats.eta} options={DATE_ONLY} />
							) : (
								"—"
							)
						}
						description={
							days !== null
								? `About ${days} full sending day${days === 1 ? "" : "s"} at this capacity.`
								: undefined
						}
					/>
					<StatCard
						label="Send window"
						value={
							<span className="text-base">
								{windowSummary(form.sendWindow)}
							</span>
						}
						description={stats.timezone}
					/>
				</div>
			</Card>

			{stats.usableInboxes === 0 ? (
				<p className="flex items-center gap-2 text-destructive text-xs">
					<Icon icon={Warning} />
					None of the chosen inboxes can send. They are paused, deleted, or
					their domain is paused. Go back to step 2.
				</p>
			) : null}

			{form.variants.length > 0 ? (
				<p className="text-muted-foreground text-xs">
					{versions.length} versions: {versions.map(versionLabel).join(" · ")}
					{form.variantColumn
						? ` — picked by ${form.variantColumn}, others in turn`
						: " — in turn"}
					. The main version is shown below.
				</p>
			) : null}

			<ReadinessPanel
				title="Outlook readiness"
				items={[
					...(readiness.data?.saved ?? []),
					...(readiness.data?.setup ?? []),
				]}
				versionNames={versions.map(versionLabel)}
				loading={readiness.isPending}
				onSendTest={() => setTestOpen(true)}
				onEditEmail={onEditEmail}
			/>

			<div className="flex flex-col gap-1 rounded-lg border p-4 text-xs">
				<span className="text-muted-foreground">Subject</span>
				<span className="font-medium text-sm">
					{form.subjectTemplate || "(empty)"}
				</span>
				<span className="mt-3 text-muted-foreground">Email</span>
				<p className="max-h-56 overflow-y-auto whitespace-pre-wrap">
					{form.bodyTemplate}
				</p>
			</div>

			{isDraft ? (
				<p className="text-muted-foreground text-xs">
					<span className="font-medium text-foreground">Start</span> puts one
					email per contact in the queue. The worker then sends them one by one,
					with random gaps, only inside the send window, and never more than
					each inbox's daily limit. You can pause at any time.
				</p>
			) : null}

			<CampaignTestSendDialog
				campaignId={campaignId}
				inboxes={readiness.data?.inboxes ?? []}
				versionNames={versions.map(versionLabel)}
				defaultTo={viewerEmail}
				open={testOpen}
				onOpenChange={setTestOpen}
			/>
		</div>
	);
}
