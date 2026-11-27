import { z } from "zod";

export const REPLY_ALERT_LIMITS = {
	emails: 20,
	recent: 10,
} as const;

export const replyAlertSettingsInput = z.object({
	enabled: z.boolean(),
	owners: z.boolean(),
	emails: z
		.array(z.string().trim().toLowerCase().pipe(z.email()))
		.max(REPLY_ALERT_LIMITS.emails),
});

export type ReplyAlertSettingsInput = z.infer<typeof replyAlertSettingsInput>;

export const replyAlertSettings = replyAlertSettingsInput.extend({
	configured: z.boolean(),
	ownerEmails: z.array(z.string()),
	canEdit: z.boolean(),
	recent: z.array(
		z.object({
			fromEmail: z.string(),
			mailbox: z.string(),
			subject: z.string().nullable(),
			receivedAt: z.string(),
			sentAt: z.string().nullable(),
			error: z.string().nullable(),
			recipients: z.array(z.string()),
		}),
	),
});

export type ReplyAlertSettings = z.infer<typeof replyAlertSettings>;
