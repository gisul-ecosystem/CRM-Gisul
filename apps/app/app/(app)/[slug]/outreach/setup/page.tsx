import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { SetupView } from "./setup-view";

export const metadata: Metadata = {
	title: "Sending setup",
};

export default function OutreachSetupPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<Setup />
		</Suspense>
	);
}

async function Setup() {
	const session = await requireSession();
	const canManage = isWorkspaceAdmin(
		await workspaceRoleOf(session.user.id, db),
	);
	return <SetupView canManage={canManage} viewerEmail={session.user.email} />;
}
