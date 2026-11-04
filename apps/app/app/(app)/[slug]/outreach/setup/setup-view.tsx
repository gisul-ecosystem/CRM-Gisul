"use client";

import { OutreachPage } from "@/components/outreach/outreach-page";
import { UrlTabs } from "@/components/outreach/url-tabs";
import { SETUP_TABS } from "@/lib/outreach/routes";
import { DomainsTab } from "./domains-tab";
import { InboxesTab } from "./inboxes-tab";
import { ProvidersTab } from "./providers-tab";

export function SetupView({
	canManage,
	viewerEmail,
}: {
	canManage: boolean;
	viewerEmail: string;
}) {
	return (
		<OutreachPage
			title="Sending setup"
			description={
				canManage
					? "The inboxes that send, their domains and DNS, and the Microsoft 365 or ZeptoMail connections behind them."
					: "The inboxes that send, their domains and the connections behind them. Only an owner or an admin can change them."
			}
		>
			<UrlTabs
				tabs={SETUP_TABS}
				labels={{
					inboxes: "Inboxes",
					domains: "Domains",
					providers: "Providers",
				}}
			>
				{{
					inboxes: (
						<InboxesTab canManage={canManage} viewerEmail={viewerEmail} />
					),
					domains: <DomainsTab canManage={canManage} />,
					providers: <ProvidersTab canManage={canManage} />,
				}}
			</UrlTabs>
		</OutreachPage>
	);
}
