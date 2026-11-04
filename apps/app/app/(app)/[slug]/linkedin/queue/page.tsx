import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { QueueView } from "./queue-view";

export const metadata: Metadata = {
	title: "LinkedIn queue",
};

export default function LinkedInQueuePage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Queue />
		</Suspense>
	);
}

async function Queue() {
	await requireSession();
	return <QueueView />;
}
