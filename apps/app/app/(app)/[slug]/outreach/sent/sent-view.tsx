"use client";

import { OutreachPage } from "@/components/outreach/outreach-page";
import { UrlTabs } from "@/components/outreach/url-tabs";
import { SENT_TABS } from "@/lib/outreach/routes";
import { ClicksTab } from "./clicks-tab";
import { SentEmailsTab } from "./sent-emails-tab";

export function SentView() {
	return (
		<OutreachPage
			title="Sent emails"
			description="Every email that left the sending inboxes, by hand in Outlook or by a campaign, and who clicked their tracking links."
		>
			<UrlTabs
				tabs={SENT_TABS}
				labels={{ emails: "Sent emails", clicks: "Link clicks" }}
			>
				{{ emails: <SentEmailsTab />, clicks: <ClicksTab /> }}
			</UrlTabs>
		</OutreachPage>
	);
}
