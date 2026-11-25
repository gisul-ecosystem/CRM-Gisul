import { redirect } from "next/navigation";
import { hubPath, LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";

export const instant = false;

export default async function LinkedinPostsRedirect({
	params,
}: PageProps<"/[slug]/linkedin/posts">) {
	const { slug } = await params;
	redirect(`/${slug}${hubPath("leads", LEAD_HUB.views.leads.posts)}`);
}
