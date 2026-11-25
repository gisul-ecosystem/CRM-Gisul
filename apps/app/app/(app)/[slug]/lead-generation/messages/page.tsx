import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadHubPage } from "@/components/lead-hub/lead-hub-page";
import { PageShellFallback } from "@/components/page-shell";
import { LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";
import { requireSession } from "@/lib/session";
import { QueuePanel } from "../../linkedin/queue/queue-view";
import { SentPanel } from "../../linkedin/sent/sent-view";

export const metadata: Metadata = {
	title: "Messages",
};

export default function MessagesPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Messages />
		</Suspense>
	);
}

async function Messages() {
	await requireSession();
	const { views } = LEAD_HUB;
	return (
		<LeadHubPage
			title="Messages"
			tabs={[
				{
					value: views.messages.queue,
					label: "LinkedIn queue",
					source: "linkedin",
					description:
						"Drafts waiting for review. Edit a draft, put one template on all of them, skip, or send.",
					content: <QueuePanel />,
				},
				{
					value: views.messages.sent,
					label: "LinkedIn sent",
					source: "linkedin",
					description:
						"LinkedIn messages sent on one day, with a downloadable report.",
					content: <SentPanel />,
				},
			]}
		/>
	);
}
