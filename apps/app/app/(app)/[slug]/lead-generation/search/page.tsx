import { redirect } from "next/navigation";
import { hubPath, LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";

export const instant = false;

export default async function LeadGenerationSearchRedirect({
	params,
}: PageProps<"/[slug]/lead-generation/search">) {
	const { slug } = await params;
	redirect(`/${slug}${hubPath("find", LEAD_HUB.views.find.website)}`);
}
