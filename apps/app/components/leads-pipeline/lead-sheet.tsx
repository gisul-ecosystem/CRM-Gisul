"use client";

import { FormattedText } from "@crm/ui/components/formatted-text";
import { Link as TextLink } from "@crm/ui/components/link";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import type { ReactNode } from "react";
import {
	intentTone,
	segmentLabel,
	segmentList,
	sourceLabel,
	verifiedTone,
} from "@/lib/leads-pipeline/labels";
import type { Lead } from "@/lib/leads-pipeline/schemas";

export function LeadSheet({
	lead,
	onClose,
}: {
	lead: Lead | null;
	onClose: () => void;
}) {
	return (
		<Sheet
			open={lead !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent size="lg" className="overflow-y-auto">
				{lead ? <LeadBody lead={lead} /> : null}
			</SheetContent>
		</Sheet>
	);
}

function website(domain: string): string {
	return `https://${domain}`;
}

function LeadBody({ lead }: { lead: Lead }) {
	const facts: [string, string][] = [
		["Country", lead.country],
		["Segment", segmentList(lead.segment)],
		["Founded", lead.founded],
		["Stage", lead.stage],
		["Team size", lead.team_size],
		["Early stage", lead.early],
		["Phone", lead.phone],
		["Email type", lead.email_type],
		["Score", lead.score],
		["Ready", lead.ready],
		["Pipeline status", lead.status],
		["Source", lead.source.split(", ").map(sourceLabel).join(", ")],
		["Found", lead.date_found],
		["Updated", lead.last_updated],
	];

	return (
		<>
			<SheetHeader>
				<SheetTitle size="lg">{lead.full_name || lead.company}</SheetTitle>
				<SheetDescription>
					{[lead.title, lead.full_name ? lead.company : lead.domain]
						.filter(Boolean)
						.join(" · ")}
				</SheetDescription>
			</SheetHeader>
			<div className="flex flex-col gap-4 px-4 pb-6">
				<div className="flex flex-wrap items-center gap-3 text-xs">
					{lead.email ? (
						<StatusIndicator
							tone={verifiedTone(lead.verified_status)}
							label={`${lead.email} (${lead.verified_status || "unchecked"})`}
							size="sm"
						/>
					) : null}
					{lead.intent ? (
						<StatusIndicator
							tone={intentTone(lead.intent)}
							label={`${segmentLabel(lead.intent)} intent`}
							size="sm"
						/>
					) : null}
				</div>

				<div className="flex flex-wrap gap-3 text-xs">
					{lead.domain ? (
						<TextLink
							href={website(lead.domain)}
							target="_blank"
							rel="noreferrer"
						>
							Website
						</TextLink>
					) : null}
					{lead.linkedin_url ? (
						<TextLink href={lead.linkedin_url} target="_blank" rel="noreferrer">
							Person on LinkedIn
						</TextLink>
					) : null}
					{lead.company_linkedin ? (
						<TextLink
							href={lead.company_linkedin}
							target="_blank"
							rel="noreferrer"
						>
							Company on LinkedIn
						</TextLink>
					) : null}
					{lead.find_people ? (
						<TextLink href={lead.find_people} target="_blank" rel="noreferrer">
							Find people
						</TextLink>
					) : null}
					{lead.signal_url ? (
						<TextLink href={lead.signal_url} target="_blank" rel="noreferrer">
							Signal source
						</TextLink>
					) : null}
				</div>

				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
					{facts
						.filter(([, value]) => value)
						.map(([label, value]) => (
							<div key={label} className="flex flex-col gap-0.5">
								<dt className="text-muted-foreground">{label}</dt>
								<dd className="break-words">{value}</dd>
							</div>
						))}
				</dl>

				{lead.signal ? (
					<Section title="Why it was found">
						<FormattedText text={lead.signal} />
					</Section>
				) : null}
				{lead.intent_signals ? (
					<Section title="Intent signals">
						<FormattedText text={lead.intent_signals} />
					</Section>
				) : null}
			</div>
		</>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-1.5">
			<h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
			{children}
		</section>
	);
}
