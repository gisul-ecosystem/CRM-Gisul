import { redirect } from "next/navigation";
import { hubPath, LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";

export const instant = false;

export default async function LinkedinSentRedirect({
	params,
}: PageProps<"/[slug]/linkedin/sent">) {
	const { slug } = await params;
	redirect(`/${slug}${hubPath("messages", LEAD_HUB.views.messages.sent)}`);
}
