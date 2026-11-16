import { ActivityType, type Db } from "@crm/db";
import {
	UNIFERS_SEND_PROVIDER,
	type UnifersSend,
	type UnifersSendInput,
	unifersSendMeta,
} from "@crm/validation/unifers-send";
import { Injectable, Logger } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";

const SENDS_LIMIT = 20;

@Injectable()
export class ContactEmailService {
	private readonly logger = new Logger(ContactEmailService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
	) {}

	async logSend(input: UnifersSendInput, actingUserId: string) {
		const contact = await this.db.contact.findFirst({
			where: { id: input.contactId, archivedAt: null },
			select: { id: true, companyId: true },
		});
		if (!contact) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
		}

		const meta = unifersSendMeta.parse({
			provider: UNIFERS_SEND_PROVIDER,
			campaignId: input.campaignId,
			sender: input.sender,
			followUpAt: input.followUpAt,
		});

		const sentAt = new Date();
		const [activity] = await this.db.$transaction([
			this.db.activity.create({
				data: {
					type: ActivityType.EMAIL,
					subject: input.subject,
					body: input.body,
					occurredAt: sentAt,
					contactId: contact.id,
					companyId: contact.companyId,
					createdById: actingUserId,
					meta,
				},
				select: { id: true },
			}),
			...(input.followUpAt
				? [
						this.db.contact.update({
							where: { id: contact.id },
							data: {
								nextFollowUpAt: new Date(`${input.followUpAt}T00:00:00Z`),
							},
							select: { id: true },
						}),
					]
				: []),
		]);

		await this.stamp.touch(
			{ companyId: contact.companyId, contactId: contact.id },
			sentAt,
		);

		this.logger.log({
			message: "Unifers email logged",
			activityId: activity.id,
			campaignId: input.campaignId,
		});

		return { id: activity.id };
	}

	async sends(contactId: string): Promise<UnifersSend[]> {
		const rows = await this.db.activity.findMany({
			where: {
				contactId,
				type: ActivityType.EMAIL,
				meta: { path: ["provider"], equals: UNIFERS_SEND_PROVIDER },
			},
			orderBy: { occurredAt: "desc" },
			take: SENDS_LIMIT,
			select: {
				id: true,
				subject: true,
				occurredAt: true,
				createdAt: true,
				meta: true,
			},
		});

		return rows.map((row) => {
			const meta = unifersSendMeta.safeParse(row.meta);
			if (!meta.success) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Activity ${row.id} has an unreadable Unifers record: ${meta.error.message}`,
				});
			}
			return {
				id: row.id,
				subject: row.subject ?? "",
				sentAt: (row.occurredAt ?? row.createdAt).toISOString(),
				campaignId: meta.data.campaignId,
				sender: meta.data.sender,
				followUpAt: meta.data.followUpAt,
			};
		});
	}
}
