"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { campaignsApi } from "@/lib/unifers/api";
import { unifersKeys, useUnifersCache } from "@/lib/unifers/cache";
import {
	DUPLICATE_RULE_LABEL,
	UNIFERS_CAMPAIGN_STATUS,
} from "@/lib/unifers/labels";
import { addLeadsInBatches, leadsSummary } from "@/lib/unifers/leads";
import {
	DUPLICATE_RULES,
	type DuplicateRule,
	type UnifersLead,
} from "@/lib/unifers/schemas";
import { UNIFERS } from "@/lib/unifers/unifers-config";

const OPEN_STATUSES = ["draft", "scheduled", "active", "paused"];

export function AddToUnifersDialog({
	open,
	leads,
	onClose,
	onDone,
}: {
	open: boolean;
	leads: UnifersLead[];
	onClose: () => void;
	onDone: () => void;
}) {
	const ids = { campaign: useId(), rule: useId() };
	const cache = useUnifersCache();
	const [campaignId, setCampaignId] = useState("");
	const [rule, setRule] = useState<DuplicateRule>("active_campaigns");

	const campaigns = useQuery({
		queryKey: unifersKeys.openCampaigns,
		queryFn: () => campaignsApi.list(0, UNIFERS.pickerSize),
		enabled: open,
	});
	const options = (campaigns.data?.campaigns ?? []).filter((campaign) =>
		OPEN_STATUSES.includes(campaign.status),
	);

	const add = useMutation({
		mutationFn: () => addLeadsInBatches(Number(campaignId), leads, rule),
		onSuccess: async (result) => {
			await cache.everything();
			toast.success(`Unifers: ${leadsSummary(result)}.`);
			if (result.rejected[0]) {
				toast.message(
					`${result.rejected[0].email ?? "A lead"}: ${result.rejected[0].message}`,
				);
			}
			onDone();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send with Unifers</DialogTitle>
					<DialogDescription>
						Adds {leads.length} {leads.length === 1 ? "person" : "people"} with
						an email to a Unifers campaign. In a running campaign their first
						email goes out at once, inside its sending window.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={ids.campaign}>Campaign</FieldLabel>
						<Select value={campaignId} onValueChange={setCampaignId}>
							<SelectTrigger id={ids.campaign}>
								<SelectValue
									placeholder={
										campaigns.isPending ? "Loading…" : "Pick a campaign"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{options.map((campaign) => (
									<SelectItem key={campaign.id} value={String(campaign.id)}>
										{campaign.name} ·{" "}
										{UNIFERS_CAMPAIGN_STATUS[campaign.status].label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={ids.rule}>Duplicates</FieldLabel>
						<Select
							value={rule}
							onValueChange={(next) => {
								const match = DUPLICATE_RULES.find((item) => item === next);
								if (match) setRule(match);
							}}
						>
							<SelectTrigger id={ids.rule}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DUPLICATE_RULES.map((item) => (
									<SelectItem key={item} value={item}>
										{DUPLICATE_RULE_LABEL[item]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					{campaigns.isError ? (
						<p className="text-destructive text-xs">
							{campaigns.error.message}
						</p>
					) : options.length === 0 && !campaigns.isPending ? (
						<p className="text-muted-foreground text-sm">
							No open Unifers campaign. Create one in Outreach → Campaigns → New
							campaign → Send with Unifers.
						</p>
					) : null}
				</FieldGroup>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!campaignId || leads.length === 0 || add.isPending}
						onClick={() => add.mutate()}
					>
						{add.isPending ? "Adding…" : `Add ${leads.length}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
