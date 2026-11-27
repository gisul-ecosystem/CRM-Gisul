"use client";

import { Badge } from "@crm/ui/components/badge";
import { WAITING_LABEL, type WaitingOn } from "@/lib/unifers/replies";

export function WaitingBadge({ on }: { on: WaitingOn | null }) {
	if (!on) return null;
	return (
		<Badge variant={on === "us" ? "secondary" : "outline"}>
			{WAITING_LABEL[on]}
		</Badge>
	);
}
