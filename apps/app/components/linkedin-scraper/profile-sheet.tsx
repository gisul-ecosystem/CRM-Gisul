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
import { LocalDateTime } from "@/components/local-date-time";
import { QUEUE_STATUS } from "@/lib/linkedin-scraper/labels";
import type { ScrapedProfile } from "@/lib/linkedin-scraper/schemas";
import { DATE_TIME, keyed } from "@/lib/outreach/format";

export function ProfileSheet({
	profile,
	onClose,
	children,
}: {
	profile: ScrapedProfile | null;
	onClose: () => void;
	children?: ReactNode;
}) {
	return (
		<Sheet
			open={profile !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent size="lg" className="overflow-y-auto">
				{profile ? (
					<ProfileBody profile={profile}>{children}</ProfileBody>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

function ProfileBody({
	profile,
	children,
}: {
	profile: ScrapedProfile;
	children?: ReactNode;
}) {
	const status = QUEUE_STATUS[profile.queueStatus];
	const message = profile.aiMessage || profile.lastMessage;

	return (
		<>
			<SheetHeader>
				<SheetTitle size="lg">{profile.name || profile.slug}</SheetTitle>
				<SheetDescription>
					{[profile.jobTitle, profile.company, profile.location]
						.filter(Boolean)
						.join(" · ") || profile.headline}
				</SheetDescription>
			</SheetHeader>
			<div className="flex flex-col gap-4 px-4 pb-6">
				<div className="flex flex-wrap items-center gap-3 text-xs">
					<StatusIndicator tone={status.tone} label={status.label} size="sm" />
					{profile.productName ? (
						<span className="text-muted-foreground">
							Product: {profile.productName}
							{profile.relevanceScore !== null
								? ` · Match ${profile.relevanceScore}/100`
								: ""}
						</span>
					) : null}
					{profile.profileUrl ? (
						<TextLink
							href={profile.profileUrl}
							target="_blank"
							rel="noreferrer"
						>
							Open on LinkedIn
						</TextLink>
					) : null}
				</div>

				{children}

				{message ? (
					<Section title="Message">
						<FormattedText text={message} />
						{profile.messageSentAt ? (
							<p className="mt-2 text-muted-foreground text-xs">
								Sent{" "}
								<LocalDateTime
									date={profile.messageSentAt}
									options={DATE_TIME}
								/>
							</p>
						) : null}
					</Section>
				) : null}

				{profile.messageError || profile.scrapeError ? (
					<p className="text-destructive text-xs">
						{profile.messageError || profile.scrapeError}
					</p>
				) : null}

				{profile.aiReason ? (
					<Section title="Why this product">
						<FormattedText text={profile.aiReason} />
						{profile.matchSignals.length > 0 ? (
							<ul className="mt-2 list-disc pl-4 text-muted-foreground text-xs">
								{keyed(profile.matchSignals, "signal").map(({ id, item }) => (
									<li key={id}>{item}</li>
								))}
							</ul>
						) : null}
					</Section>
				) : null}

				{profile.headline ? (
					<Section title="Headline">
						<FormattedText text={profile.headline} />
					</Section>
				) : null}
				{profile.about ? (
					<Section title="About">
						<FormattedText text={profile.about} />
					</Section>
				) : null}
				{profile.experience ? (
					<Section title="Experience">
						<FormattedText text={profile.experience} />
					</Section>
				) : null}
				{profile.education ? (
					<Section title="Education">
						<FormattedText text={profile.education} />
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
			<div className="rounded-lg border p-3 text-sm">{children}</div>
		</section>
	);
}
