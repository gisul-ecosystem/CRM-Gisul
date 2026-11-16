"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { CAMPAIGN_SENDERS } from "@/lib/unifers/sender";
import { CampaignWizardPage } from "../wizard/campaign-wizard";
import { UnifersCampaignWizard } from "../wizard/unifers-wizard";

const CHOICES = [
	{
		sender: "engine",
		title: "Outreach Engine",
		description:
			"Sends from the inboxes in Outreach → Sending setup, with readiness checks and test sends.",
	},
	{
		sender: "unifers",
		title: "Unifers",
		description:
			"Sends from your Unifers mailboxes. Unifers runs the sequence, tracking and reply detection.",
	},
] as const;

export function NewCampaign({ viewerEmail }: { viewerEmail: string }) {
	const [sender, setSender] = useQueryState(
		"sender",
		parseAsStringLiteral(CAMPAIGN_SENDERS),
	);

	if (sender === "engine")
		return <CampaignWizardPage viewerEmail={viewerEmail} />;
	if (sender === "unifers") return <UnifersCampaignWizard />;

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>New campaign</PageShellTitle>
					<PageShellDescription>
						Choose what sends this campaign.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<div className="grid gap-6 md:grid-cols-2">
					{CHOICES.map((choice) => (
						<Card key={choice.sender}>
							<CardHeader>
								<CardTitle>Send with {choice.title}</CardTitle>
								<CardDescription>{choice.description}</CardDescription>
							</CardHeader>
							<CardContent />
							<CardFooter>
								<Button onClick={() => void setSender(choice.sender)}>
									Use {choice.title}
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			</PageShellContent>
		</PageShell>
	);
}
