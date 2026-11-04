"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Play from "@carbon/icons-react/es/Play";
import Save from "@carbon/icons-react/es/Save";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { useMutation, useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { OutreachPage } from "@/components/outreach/outreach-page";
import { readinessSummary } from "@/components/outreach/readiness-panel";
import { type CampaignDraft, campaignApi } from "@/lib/outreach/api";
import { outreachKeys, useOutreachCache } from "@/lib/outreach/cache";
import { COUNT } from "@/lib/outreach/format";
import type { Campaign } from "@/lib/outreach/schemas/campaign";
import {
	emailFields,
	formFromCampaign,
	LAST_STEP,
	sendWindowProblem,
	stepProblem,
	WIZARD_STEPS,
	type WizardForm,
	type WizardStep,
} from "@/lib/outreach/wizard";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { StepBasics } from "./step-basics";
import { StepEmail } from "./step-email";
import { StepInboxes } from "./step-inboxes";
import { StepReview } from "./step-review";
import { StepWindow } from "./step-window";

export function CampaignWizardPage({
	campaign,
	viewerEmail,
}: {
	campaign?: Campaign;
	viewerEmail: string;
}) {
	const href = useWorkspaceUrl();

	return (
		<OutreachPage
			title={campaign ? `Edit “${campaign.name}”` : "New campaign"}
			description={
				<NextLink
					href={href("/outreach/campaigns")}
					className="inline-flex items-center gap-1 hover:text-foreground"
				>
					<Icon icon={ArrowLeft} />
					Campaigns
				</NextLink>
			}
		>
			<CampaignWizard campaign={campaign} viewerEmail={viewerEmail} />
		</OutreachPage>
	);
}

export function CampaignWizardForId({
	id,
	viewerEmail,
}: {
	id: string;
	viewerEmail: string;
}) {
	const campaign = useQuery({
		queryKey: outreachKeys.campaign(id),
		queryFn: () => campaignApi.get(id),
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (campaign.isPending) {
		return (
			<OutreachPage title="Edit campaign">
				<p className="text-muted-foreground text-xs">Loading…</p>
			</OutreachPage>
		);
	}

	if (campaign.isError) {
		return (
			<OutreachPage title="Edit campaign">
				<p className="text-destructive text-xs">{campaign.error.message}</p>
			</OutreachPage>
		);
	}

	return (
		<CampaignWizardPage campaign={campaign.data} viewerEmail={viewerEmail} />
	);
}

function CampaignWizard({
	campaign,
	viewerEmail,
}: {
	campaign?: Campaign;
	viewerEmail: string;
}) {
	const href = useWorkspaceUrl();
	const router = useRouter();
	const cache = useOutreachCache();
	const [campaignId, setCampaignId] = useState<string | null>(
		campaign?.id ?? null,
	);
	const [step, setStep] = useState<WizardStep>(0);
	const [form, setForm] = useState<WizardForm>(() =>
		formFromCampaign(campaign),
	);
	const [confirmStart, setConfirmStart] = useState(false);

	const saved = useQuery({
		queryKey: campaignId
			? outreachKeys.campaign(campaignId)
			: [...outreachKeys.campaigns, "none"],
		queryFn: () => (campaignId ? campaignApi.get(campaignId) : null),
		enabled: Boolean(campaignId),
	});
	const stats = useQuery({
		queryKey: campaignId
			? [...outreachKeys.campaign(campaignId), "stats"]
			: [...outreachKeys.campaigns, "none", "stats"],
		queryFn: () => (campaignId ? campaignApi.stats(campaignId) : null),
		enabled: Boolean(campaignId),
	});
	const readiness = useQuery({
		queryKey: campaignId
			? [...outreachKeys.campaign(campaignId), "readiness"]
			: [...outreachKeys.campaigns, "none", "readiness"],
		queryFn: () => (campaignId ? campaignApi.readiness(campaignId) : null),
		enabled: Boolean(campaignId) && step === LAST_STEP,
	});

	const status = saved.data?.status ?? campaign?.status ?? "draft";
	const isDraft = status === "draft";
	const isFollowUp = form.followUpOf !== null;
	const mustFix = readinessSummary([
		...(readiness.data?.saved ?? []),
		...(readiness.data?.setup ?? []),
	]).errors;

	const patch = (next: Partial<WizardForm>) =>
		setForm((previous) => ({ ...previous, ...next }));

	function draftFor(target: WizardStep | "all"): CampaignDraft | null {
		const listId =
			isDraft && !isFollowUp && form.listId ? form.listId : undefined;
		switch (target) {
			case 0:
				return {
					name: form.name,
					listId,
					followUpAfterDays: isFollowUp ? form.followUpAfterDays : undefined,
				};
			case 1:
				return isFollowUp ? null : { inboxIds: form.inboxIds };
			case 2:
				return emailFields(form);
			case 3:
				return { sendWindow: form.sendWindow };
			case 4:
				return null;
			case "all": {
				const draft: CampaignDraft = { ...emailFields(form), listId };
				if (form.name.trim()) draft.name = form.name;
				if (!isFollowUp) draft.inboxIds = form.inboxIds;
				if (sendWindowProblem(form.sendWindow) === null)
					draft.sendWindow = form.sendWindow;
				return draft;
			}
		}
	}

	const save = useMutation({
		mutationFn: async (target: WizardStep | "all") => {
			if (!campaignId) {
				if (!form.name.trim() || !form.listId) return null;
				const draft: CampaignDraft = {
					name: form.name,
					listId: form.listId,
					followUpOf: form.followUpOf,
					followUpAfterDays: form.followUpAfterDays,
				};
				if (target === "all") {
					Object.assign(draft, emailFields(form), { inboxIds: form.inboxIds });
				}
				const created = await campaignApi.create(draft);
				setCampaignId(created.id);
				patch({ listId: created.listId, inboxIds: created.inboxIds });
				window.history.replaceState(
					null,
					"",
					href(`/outreach/campaigns/${created.id}/edit`),
				);
				return created;
			}

			const draft = draftFor(target);
			if (!draft) return null;
			return campaignApi.update(campaignId, draft);
		},
		onSuccess: async () => {
			await cache.campaigns(campaignId ?? undefined);
		},
	});

	const start = useMutation({
		mutationFn: (id: string) => campaignApi.start(id),
		onSuccess: async (result) => {
			await cache.campaigns(result.campaign.id);
			toast.success(
				`Started. ${COUNT.format(result.pending)} email${result.pending === 1 ? "" : "s"} queued.`,
			);
			router.push(href(`/outreach/campaigns/${result.campaign.id}`));
		},
		onError: (error) => {
			setConfirmStart(false);
			toast.error(error.message);
		},
	});

	const busy = save.isPending || start.isPending;

	async function next() {
		const problem = stepProblem(step, form);
		if (problem) {
			toast.error(problem);
			return;
		}
		try {
			await save.mutateAsync(step);
			setStep((current) => Math.min(LAST_STEP, current + 1) as WizardStep);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	}

	async function saveAndExit() {
		try {
			await save.mutateAsync("all");
			toast.success(isDraft ? "Draft saved." : "Changes saved.");
			router.push(
				href(
					campaignId && !isDraft
						? `/outreach/campaigns/${campaignId}`
						: "/outreach/campaigns",
				),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	}

	const sendable = stats.data?.audience.sendable ?? 0;
	const canStart =
		!busy &&
		Boolean(stats.data) &&
		(stats.data?.usableInboxes ?? 0) > 0 &&
		(isFollowUp || sendable > 0) &&
		mustFix === 0 &&
		!readiness.isPending;

	return (
		<div className="flex flex-col gap-6">
			<ol className="flex flex-wrap gap-2" aria-label="Steps">
				{WIZARD_STEPS.map((label, index) => (
					<li key={label}>
						<Button
							size="sm"
							variant={
								index === step ? "default" : index < step ? "outline" : "ghost"
							}
							disabled={index >= step || busy}
							aria-current={index === step ? "step" : undefined}
							onClick={() => setStep(index as WizardStep)}
						>
							{index + 1}. {label}
						</Button>
					</li>
				))}
			</ol>

			<div>
				{step === 0 ? (
					<StepBasics
						form={form}
						onChange={patch}
						listLocked={!isDraft}
						typeLocked={Boolean(campaignId)}
					/>
				) : null}
				{step === 1 ? <StepInboxes form={form} onChange={patch} /> : null}
				{step === 2 && campaignId ? (
					<StepEmail
						campaignId={campaignId}
						form={form}
						onChange={patch}
						viewerEmail={viewerEmail}
					/>
				) : null}
				{step === 3 ? (
					<StepWindow
						form={form}
						onChange={patch}
						timezone={stats.data?.timezone ?? null}
					/>
				) : null}
				{step === LAST_STEP && campaignId ? (
					<StepReview
						campaignId={campaignId}
						listName={saved.data?.listName ?? null}
						form={form}
						stats={stats.data ?? undefined}
						viewerEmail={viewerEmail}
						onEditEmail={() => setStep(2)}
					/>
				) : null}
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
				<Button variant="ghost" onClick={saveAndExit} disabled={busy}>
					<Icon icon={Save} data-icon="inline-start" />
					{isDraft ? "Save draft and exit" : "Save and exit"}
				</Button>
				<div className="flex gap-2">
					{step > 0 ? (
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setStep((current) => (current - 1) as WizardStep)}
						>
							Back
						</Button>
					) : null}
					{step < LAST_STEP ? (
						<Button onClick={next} disabled={busy}>
							{busy ? "Saving…" : "Next"}
						</Button>
					) : isDraft ? (
						<Button
							disabled={!canStart}
							title={mustFix > 0 ? "Fix the red items first" : undefined}
							onClick={() => setConfirmStart(true)}
						>
							<Icon icon={Play} data-icon="inline-start" />
							Start campaign
						</Button>
					) : (
						<Button
							disabled={busy}
							onClick={() =>
								router.push(href(`/outreach/campaigns/${campaignId}`))
							}
						>
							Done
						</Button>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={confirmStart}
				destructive={false}
				title={`Start “${form.name}”?`}
				description={`${
					isFollowUp
						? `Each person who got the first email gets this follow-up ${form.followUpAfterDays} days later, unless they replied or it bounced.`
						: `${COUNT.format(sendable)} email${sendable === 1 ? "" : "s"} will be queued.`
				} The worker sends them one by one inside the send window. You can pause at any time.`}
				action={start.isPending ? "Starting…" : "Start"}
				pending={start.isPending}
				onConfirm={() => (campaignId ? start.mutate(campaignId) : undefined)}
				onClose={() => setConfirmStart(false)}
			/>
		</div>
	);
}
