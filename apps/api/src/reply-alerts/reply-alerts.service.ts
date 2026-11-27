import {
	appUrl,
	isWorkspaceAdmin,
	WORKSPACE_ID,
	workspaceRoleOf,
} from "@crm/auth";
import type { Db } from "@crm/db";
import { SETTINGS_ID } from "@crm/db/settings";
import {
	REPLY_ALERT_LIMITS,
	type ReplyAlertSettings,
	type ReplyAlertSettingsInput,
} from "@crm/validation/reply-alerts";
import {
	ForbiddenException,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { isMachineAddress } from "../mailbox/participants";
import { replyAlertHtml, replyAlertSubject } from "./reply-alert-email";
import { REPLY_ALERTS } from "./reply-alerts.config";
import {
	type InboxMessage,
	type SendingMailbox,
	senderOf,
	TenantMailClient,
} from "./tenant-mail.client";

type Rule = { enabled: boolean; owners: boolean; emails: string[] };

export function alertRecipients(
	rule: Rule,
	ownerEmails: readonly string[],
): string[] {
	const all = [...(rule.owners ? ownerEmails : []), ...rule.emails].map(
		(email) => email.trim().toLowerCase(),
	);
	return [...new Set(all.filter((email) => email.includes("@")))];
}

export function isIgnoredSender(
	from: string,
	internal: ReadonlySet<string>,
): boolean {
	if (!from || internal.has(from) || isMachineAddress(from)) return true;
	const local = from.split("@")[0] ?? "";
	return REPLY_ALERTS.ignoredSenders.some(
		(prefix) => local === prefix || local.startsWith(`${prefix}+`),
	);
}

@Injectable()
export class ReplyAlertsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(ReplyAlertsService.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private starter: ReturnType<typeof setTimeout> | null = null;
	private running = false;
	private readonly notReplies = new Map<string, number>();

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly mail: TenantMailClient,
	) {}

	onModuleInit() {
		if (!this.mail.configured()) return;
		const run = () => {
			this.tick().catch((error) => {
				this.logger.error(
					{ message: "Reply alert check failed" },
					error instanceof Error ? error.stack : String(error),
				);
			});
		};
		this.timer = setInterval(run, REPLY_ALERTS.tick.intervalMs);
		this.starter = setTimeout(run, REPLY_ALERTS.tick.firstRunMs);
	}

	onModuleDestroy() {
		if (this.timer) clearInterval(this.timer);
		if (this.starter) clearTimeout(this.starter);
		this.timer = null;
		this.starter = null;
	}

	async settings(userId: string): Promise<ReplyAlertSettings> {
		const [rule, ownerEmails, role, recent] = await Promise.all([
			this.rule(),
			this.ownerEmails(),
			workspaceRoleOf(userId, this.db),
			this.db.replyAlert.findMany({
				orderBy: { receivedAt: "desc" },
				take: REPLY_ALERT_LIMITS.recent,
			}),
		]);
		return {
			...rule,
			configured: this.mail.configured(),
			ownerEmails,
			canEdit: isWorkspaceAdmin(role),
			recent: recent.map((row) => ({
				fromEmail: row.fromEmail,
				mailbox: row.mailbox,
				subject: row.subject,
				receivedAt: row.receivedAt.toISOString(),
				sentAt: row.sentAt?.toISOString() ?? null,
				error: row.error,
				recipients: row.recipients,
			})),
		};
	}

	async update(
		userId: string,
		input: ReplyAlertSettingsInput,
	): Promise<ReplyAlertSettings> {
		const role = await workspaceRoleOf(userId, this.db);
		if (!isWorkspaceAdmin(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change reply alerts.",
			);
		}
		const data = {
			replyAlertsEnabled: input.enabled,
			replyAlertOwners: input.owners,
			replyAlertEmails: [...new Set(input.emails)],
		};
		await this.db.appSetting.upsert({
			where: { id: SETTINGS_ID },
			create: { id: SETTINGS_ID, ...data },
			update: data,
		});
		this.logger.log({ message: "Reply alert settings updated", userId });
		return this.settings(userId);
	}

	async tick(): Promise<void> {
		if (this.running || !this.mail.configured()) return;
		this.running = true;
		try {
			await this.check();
		} finally {
			this.running = false;
		}
	}

	private async check(): Promise<void> {
		const rule = await this.rule();
		if (!rule.enabled) return;
		const recipients = alertRecipients(rule, await this.ownerEmails());
		if (recipients.length === 0) return;

		const mailboxes = await this.mail.mailboxes();
		if (mailboxes.length === 0) return;
		const users = await this.db.user.findMany({ select: { email: true } });
		const internal = new Set([
			...mailboxes.map((mailbox) => mailbox.email),
			...users.map((user) => user.email.toLowerCase()),
		]);
		const since = new Date(Date.now() - REPLY_ALERTS.tick.lookbackMs);
		this.forgetBefore(since.getTime());

		for (const mailbox of mailboxes) {
			try {
				await this.checkMailbox(mailbox, since, internal, recipients);
			} catch (error) {
				this.logger.warn({
					message: "Reply alerts could not read a mailbox",
					mailbox: mailbox.email,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	private async checkMailbox(
		mailbox: SendingMailbox,
		since: Date,
		internal: ReadonlySet<string>,
		recipients: readonly string[],
	): Promise<void> {
		const messages = (await this.mail.inbox(mailbox.email, since)).filter(
			(message) =>
				!message.isDraft &&
				Boolean(message.conversationId) &&
				!this.notReplies.has(message.id) &&
				!isIgnoredSender(senderOf(message), internal),
		);
		if (messages.length === 0) return;
		const known = await this.db.replyAlert.findMany({
			where: { messageId: { in: messages.map((message) => message.id) } },
			select: { messageId: true },
		});
		const done = new Set(known.map((row) => row.messageId));

		for (const message of messages.reverse()) {
			if (done.has(message.id) || !message.conversationId) continue;
			const ours = await this.mail.weWroteIn(
				mailbox.email,
				message.conversationId,
			);
			if (!ours) {
				this.notReplies.set(message.id, Date.now());
				continue;
			}
			await this.alert(mailbox, message, recipients);
		}
	}

	private async alert(
		mailbox: SendingMailbox,
		message: InboxMessage,
		recipients: readonly string[],
	): Promise<void> {
		const fromEmail = senderOf(message);
		const receivedAt = new Date(message.receivedDateTime);
		const claimed = await this.db.replyAlert.createMany({
			data: [
				{
					messageId: message.id,
					mailbox: mailbox.email,
					fromEmail,
					subject: message.subject ?? null,
					receivedAt,
					recipients: [...recipients],
				},
			],
			skipDuplicates: true,
		});
		if (claimed.count === 0) return;

		const content = {
			fromEmail,
			fromName: message.from?.emailAddress.name?.trim() || null,
			mailbox: mailbox.email,
			subject: message.subject ?? null,
			text: message.uniqueBody?.content ?? message.bodyPreview ?? "",
			receivedAt,
			crmUrl: await this.crmUrl(fromEmail),
			outlookUrl: message.webLink ?? null,
		};
		try {
			await this.mail.send(
				mailbox.email,
				recipients,
				replyAlertSubject(content),
				replyAlertHtml(content),
			);
			await this.db.replyAlert.update({
				where: { messageId: message.id },
				data: { sentAt: new Date() },
			});
			this.logger.log({
				message: "Reply alert sent",
				mailbox: mailbox.email,
				recipients: recipients.length,
			});
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			await this.db.replyAlert.update({
				where: { messageId: message.id },
				data: { error: reason.slice(0, 500) },
			});
			this.logger.warn({
				message: "Reply alert could not be sent",
				mailbox: mailbox.email,
				reason,
			});
		}
	}

	private async crmUrl(email: string): Promise<string> {
		const [workspace, contact] = await Promise.all([
			this.db.organization.findUnique({
				where: { id: WORKSPACE_ID },
				select: { slug: true },
			}),
			this.db.contact.findFirst({
				where: { email: { equals: email, mode: "insensitive" } },
				select: { id: true },
			}),
		]);
		const slug = workspace?.slug ?? "";
		const path = contact
			? `/${slug}/contacts/${contact.id}`
			: `/${slug}/outreach/campaigns?sender=unifers`;
		return new URL(path, appUrl).toString();
	}

	private async rule(): Promise<Rule> {
		const row = await this.db.appSetting.findUnique({
			where: { id: SETTINGS_ID },
			select: {
				replyAlertsEnabled: true,
				replyAlertOwners: true,
				replyAlertEmails: true,
			},
		});
		return {
			enabled: row?.replyAlertsEnabled ?? true,
			owners: row?.replyAlertOwners ?? true,
			emails: row?.replyAlertEmails ?? [],
		};
	}

	private async ownerEmails(): Promise<string[]> {
		const owners = await this.db.member.findMany({
			where: {
				organizationId: WORKSPACE_ID,
				role: "owner",
				user: { removedAt: null },
			},
			select: { user: { select: { email: true } } },
		});
		return owners.map((owner) => owner.user.email.toLowerCase());
	}

	private forgetBefore(time: number): void {
		for (const [id, at] of this.notReplies) {
			if (at < time) this.notReplies.delete(id);
		}
	}
}
