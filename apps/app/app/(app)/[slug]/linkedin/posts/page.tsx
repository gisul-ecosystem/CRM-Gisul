import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { PostsView } from "./posts-view";

export const metadata: Metadata = {
	title: "LinkedIn found posts",
};

export default function LinkedInPostsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Posts />
		</Suspense>
	);
}

async function Posts() {
	await requireSession();
	return <PostsView />;
}
