import { StatusIndicator } from "@crm/ui/components/status-indicator";
import type { StatusLabel } from "@/lib/outreach/labels";

export function OutreachStatus({
	status,
	pulse = false,
}: {
	status: StatusLabel;
	pulse?: boolean;
}) {
	return (
		<StatusIndicator
			tone={status.tone}
			label={status.label}
			pulse={pulse}
			size="sm"
		/>
	);
}
