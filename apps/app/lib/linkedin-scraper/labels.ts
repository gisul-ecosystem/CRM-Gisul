import type { StatusTone } from "@crm/ui/components/status-indicator";
import type { JobStatus, QueueStatus } from "./schemas";

export type StatusLabel = { label: string; tone: StatusTone };

export const QUEUE_STATUS = {
	scraped: { label: "Scraped", tone: "neutral" },
	queued: { label: "Draft ready", tone: "info" },
	sent: { label: "Sent", tone: "success" },
	failed: { label: "Failed", tone: "error" },
	skipped: { label: "Skipped", tone: "warning" },
	cleared: { label: "Cleared", tone: "neutral" },
} as const satisfies Record<QueueStatus, StatusLabel>;

export const JOB_STATUS = {
	idle: { label: "Idle", tone: "neutral" },
	running: { label: "Running", tone: "primary" },
	completed: { label: "Completed", tone: "success" },
	failed: { label: "Failed", tone: "error" },
} as const satisfies Record<JobStatus, StatusLabel>;
