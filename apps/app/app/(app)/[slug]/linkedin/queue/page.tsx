import { redirect } from "next/navigation";
import { hubPath, LEAD_HUB } from "@/lib/lead-hub/lead-hub-config";

export const instant = false;

export default async function LinkedinQueueRedirect({
	params,
}: PageProps<"/[slug]/linkedin/queue">) {
	const { slug } = await params;
	redirect(`/${slug}${hubPath("messages", LEAD_HUB.views.messages.queue)}`);
}
