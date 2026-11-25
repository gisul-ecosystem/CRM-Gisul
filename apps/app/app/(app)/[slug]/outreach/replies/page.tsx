import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { RepliesView } from "./replies-view";

export const metadata: Metadata = {
	title: "Replies",
};

export default function OutreachRepliesPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Replies />
		</Suspense>
	);
}

async function Replies() {
	await requireSession();
	return <RepliesView />;
}
