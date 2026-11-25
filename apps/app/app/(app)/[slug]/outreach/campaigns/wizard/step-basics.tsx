"use client";

import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Link as TextLink } from "@crm/ui/components/link";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useId } from "react";
import { audienceApi, campaignApi } from "@/lib/outreach/api";
import { outreachKeys } from "@/lib/outreach/cache";
import { CAMPAIGN } from "@/lib/outreach/campaign-rules";
import { COUNT } from "@/lib/outreach/format";
import type { WizardForm } from "@/lib/outreach/wizard";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const FIRST = "first";
const FOLLOW_UP = "follow-up";
const PICKER_LIMIT = 100;

export function StepBasics({
	form,
	onChange,
	listLocked,
	typeLocked,
}: {
	form: WizardForm;
	onChange: (patch: Partial<WizardForm>) => void;
	listLocked: boolean;
	typeLocked: boolean;
}) {
	const href = useWorkspaceUrl();
	const nameId = useId();
	const daysId = useId();

	const lists = useQuery({
		queryKey: [...outreachKeys.lists, "picker"],
		queryFn: () => audienceApi.lists({ page: 1, limit: PICKER_LIMIT }),
	});
	const campaigns = useQuery({
		queryKey: [...outreachKeys.campaigns, "picker"],
		queryFn: () => campaignApi.list({ page: 1, limit: PICKER_LIMIT }),
	});

	const parents = (campaigns.data?.data ?? []).filter(
		(campaign) => !campaign.followUpOf,
	);
	const isFollowUp = form.followUpOf !== null;

	return (
		<div className="flex max-w-xl flex-col gap-5">
			<Field>
				<FieldLabel htmlFor={nameId}>Campaign name</FieldLabel>
				<Input
					id={nameId}
					value={form.name}
					maxLength={200}
					onChange={(event) => onChange({ name: event.target.value })}
				/>
				<FieldDescription>
					Only your team sees this name. It is not part of the email.
				</FieldDescription>
			</Field>

			<Field>
				<FieldLabel>Type</FieldLabel>
				<Select
					value={isFollowUp ? FOLLOW_UP : FIRST}
					disabled={typeLocked}
					onValueChange={(value) =>
						onChange(
							value === FOLLOW_UP
								? { followUpOf: "", listId: null }
								: { followUpOf: null },
						)
					}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={FIRST}>First email to a contact list</SelectItem>
						<SelectItem value={FOLLOW_UP}>
							Follow-up of an earlier campaign
						</SelectItem>
					</SelectContent>
				</Select>
				<FieldDescription>
					A follow-up only goes to people who got the first email and did not
					reply, from the same inbox, in the same conversation. One follow-up
					per campaign.
				</FieldDescription>
			</Field>

			{isFollowUp ? (
				<>
					<Field>
						<FieldLabel>First campaign</FieldLabel>
						<Select
							value={form.followUpOf || undefined}
							disabled={typeLocked}
							onValueChange={(id) => {
								const parent = parents.find((campaign) => campaign.id === id);
								onChange({ followUpOf: id, listId: parent?.listId ?? null });
							}}
						>
							<SelectTrigger>
								<SelectValue
									placeholder={
										campaigns.isPending
											? "Loading campaigns…"
											: "Choose a campaign"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{parents.map((campaign) => (
									<SelectItem key={campaign.id} value={campaign.id}>
										{campaign.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={daysId}>Send after (days)</FieldLabel>
						<Input
							id={daysId}
							type="number"
							min={CAMPAIGN.followUp.minDays}
							max={CAMPAIGN.followUp.maxDays}
							className="w-28"
							value={form.followUpAfterDays}
							onChange={(event) =>
								onChange({
									followUpAfterDays:
										Number(event.target.value) || CAMPAIGN.followUp.minDays,
								})
							}
						/>
						<FieldDescription>
							Days after the first email. Three or four is usual.
						</FieldDescription>
					</Field>
				</>
			) : (
				<Field>
					<FieldLabel>Contact list</FieldLabel>
					<Select
						value={form.listId ?? undefined}
						disabled={listLocked}
						onValueChange={(listId) => onChange({ listId })}
					>
						<SelectTrigger>
							<SelectValue
								placeholder={
									lists.isPending
										? "Loading lists…"
										: lists.data?.data.length
											? "Choose a list"
											: "No lists yet"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{(lists.data?.data ?? []).map((list) => (
								<SelectItem key={list.id} value={list.id}>
									{list.name} ({COUNT.format(list.contactCount)} contacts)
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>
						{listLocked ? (
							"The list cannot change after the campaign has started."
						) : (
							<>
								Every contact in this list gets one email. Need a new list?{" "}
								<TextLink asChild>
									<NextLink href={href("/outreach/audiences")}>
										Import contacts
									</NextLink>
								</TextLink>
								.
							</>
						)}
					</FieldDescription>
				</Field>
			)}
		</div>
	);
}
