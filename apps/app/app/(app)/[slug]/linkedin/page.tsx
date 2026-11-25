import { redirect } from "next/navigation";
import { hubPath, LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";

export const instant = false;

export default async function LinkedinRedirect({
	params,
}: PageProps<"/[slug]/linkedin">) {
	const { slug } = await params;
	redirect(`/${slug}${hubPath("overview", LEAD_HUB.views.overview.linkedin)}`);
}
