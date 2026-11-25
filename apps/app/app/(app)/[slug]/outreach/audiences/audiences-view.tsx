"use client";

import { OutreachPage } from "@/components/outreach/outreach-page";
import { UrlTabs } from "@/components/outreach/url-tabs";
import { AUDIENCE_TABS } from "@/lib/outreach/routes";
import { ContactsTab } from "./contacts-tab";
import { ListsTab } from "./lists-tab";
import { SuppressionsTab } from "./suppressions-tab";

export function AudiencesView() {
	return (
		<OutreachPage
			title="Audiences"
			description="The people Outreach emails: contacts imported from CSV, the lists campaigns target, and everyone who must never be emailed."
		>
			<UrlTabs
				tabs={AUDIENCE_TABS}
				labels={{
					contacts: "Contacts",
					lists: "Lists",
					suppressions: "Suppressions",
				}}
			>
				{{
					contacts: <ContactsTab />,
					lists: <ListsTab />,
					suppressions: <SuppressionsTab />,
				}}
			</UrlTabs>
		</OutreachPage>
	);
}
