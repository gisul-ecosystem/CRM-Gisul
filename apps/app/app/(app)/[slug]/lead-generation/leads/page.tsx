import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadHubPage } from "@/components/lead-hub/lead-hub-page";
import { PageShellFallback } from "@/components/page-shell";
import { LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";
import { requireSession } from "@/lib/session";
import { CompaniesPanel } from "../../linkedin/companies/companies-view";
import { PostsPanel } from "../../linkedin/posts/posts-view";
import { ProfilesPanel } from "../../linkedin/profiles/profiles-view";
import { LeadsPanel } from "./leads-view";

export const metadata: Metadata = {
	title: "Leads",
};

export default function LeadsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Leads />
		</Suspense>
	);
}

async function Leads() {
	await requireSession();
	const { views } = LEAD_HUB;
	return (
		<LeadHubPage
			title="Leads"
			tabs={[
				{
					value: views.leads.website,
					label: "Website leads",
					source: "website",
					description:
						"Every company and decision maker the website pipeline found, best score first.",
					content: <LeadsPanel />,
				},
				{
					value: views.leads.profiles,
					label: "LinkedIn profiles",
					source: "linkedin",
					description:
						"Every person read on LinkedIn, with the product the AI matched.",
					content: <ProfilesPanel />,
				},
				{
					value: views.leads.posts,
					label: "Found posts",
					source: "linkedin",
					description:
						"LinkedIn posts where the AI found a need for our products, newest first.",
					content: <PostsPanel />,
				},
				{
					value: views.leads.companies,
					label: "LinkedIn companies",
					source: "linkedin",
					description:
						"Companies found with LinkedIn company search, newest first. Click a row for every detail.",
					content: <CompaniesPanel />,
				},
			]}
		/>
	);
}
