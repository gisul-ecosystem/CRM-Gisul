import { z } from "zod";
import { nullableDate } from "./enums";

export const READINESS_LEVELS = ["ok", "warning", "error"] as const;
export const READINESS_FIELDS = [
	"subjectTemplate",
	"bodyTemplate",
	"bodyHtml",
] as const;

const readinessField = z.enum(READINESS_FIELDS);

export const readinessFix = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("insert"),
		label: z.string(),
		field: readinessField,
		text: z.string(),
		at: z.enum(["start", "end", "before-opt-out"]),
	}),
	z.object({
		kind: z.literal("replace"),
		label: z.string(),
		field: readinessField,
		find: z.string(),
		replace: z.string(),
	}),
	z.object({
		kind: z.literal("show"),
		field: readinessField,
		find: z.string(),
	}),
	z.object({ kind: z.literal("link"), label: z.string(), href: z.string() }),
	z.object({ kind: z.literal("send-test") }),
	z.object({ kind: z.literal("recheck-dns"), domainId: z.string() }),
]);

export const readinessItem = z.object({
	key: z.string(),
	check: z.string(),
	level: z.enum(READINESS_LEVELS),
	message: z.string(),
	template: z.number().optional(),
	fixes: z.array(readinessFix).optional(),
});

export const campaignReadiness = z.object({
	context: z.object({
		isFollowUp: z.boolean(),
		customVariables: z.array(z.string()).optional(),
		sendingDomains: z.array(z.string()).optional(),
		emptyFields: z.record(z.string(), z.number()).optional(),
	}),
	inboxes: z.array(
		z.object({
			id: z.string(),
			email: z.string(),
			displayName: z.string(),
			senderName: z.string(),
			senderRole: z.string(),
			status: z.string(),
			connectionId: z.string().nullable(),
		}),
	),
	setup: z.array(readinessItem),
	saved: z.array(readinessItem),
	testSentAt: nullableDate,
});

export type ReadinessLevel = (typeof READINESS_LEVELS)[number];
export type ReadinessFix = z.infer<typeof readinessFix>;
export type ReadinessItem = z.infer<typeof readinessItem>;
export type CampaignReadiness = z.infer<typeof campaignReadiness>;
