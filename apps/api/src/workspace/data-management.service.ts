import { gunzipSync, gzipSync } from "node:zlib";
import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import { DataTransferKind, type Db, Prisma } from "@crm/db";
import { readArchiveRetentionDays } from "@crm/db/settings";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { ARCHIVE } from "../archive/archive-config";
import { companyExportInput } from "../companies/companies.contracts";
import { CompaniesService } from "../companies/companies.service";
import { contactExportInput } from "../contacts/contacts.contracts";
import { ContactsService } from "../contacts/contacts.service";
import type { BulkResult } from "../crm/bulk";
import { InjectDatabase } from "../database/database.constants";
import { dealExportInput } from "../deals/deals.contracts";
import { DealsService } from "../deals/deals.service";
import type {
	ArchiveInactiveRecordsInput,
	BackupIdInput,
	BackupItem,
	ClearDeletedDataInput,
	CreateBackupInput,
	DataEntity,
	DataManagementOverview,
	DuplicateEntityInput,
	DuplicateGroups,
	EntityInput,
	ImportDataInput,
} from "./workspace.contracts";
import { DATA_ENTITIES } from "./workspace.contracts";
import { DATA_MANAGEMENT, DAY_MS } from "./workspace-config";

const duplicateRows = z.array(
	z.object({
		key: z.string(),
		records: z.array(z.object({ id: z.string(), name: z.string() })),
	}),
);

const BACKUP_SELECT = {
	id: true,
	name: true,
	createdAt: true,
	sizeBytes: true,
	recordCount: true,
} as const;

@Injectable()
export class DataManagementService {
	private readonly logger = new Logger(DataManagementService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly contacts: ContactsService,
		private readonly companies: CompaniesService,
		private readonly deals: DealsService,
	) {}

	async overview(userId: string): Promise<DataManagementOverview> {
		const since = new Date(
			Date.now() - DATA_MANAGEMENT.transfers.windowDays * DAY_MS,
		);

		const [
			contacts,
			companies,
			deals,
			activities,
			transfers,
			backups,
			retentionDays,
			recentImports,
			role,
		] = await Promise.all([
			this.db.contact.count({ where: { archivedAt: null } }),
			this.db.company.count({ where: { archivedAt: null } }),
			this.db.deal.count({ where: { archivedAt: null } }),
			this.db.activity.count(),
			this.db.dataTransfer.groupBy({
				by: ["kind"],
				where: { createdAt: { gte: since } },
				_count: { _all: true },
			}),
			this.db.workspaceBackup.findMany({
				select: BACKUP_SELECT,
				orderBy: { createdAt: "desc" },
				take: DATA_MANAGEMENT.backups.listLimit,
			}),
			readArchiveRetentionDays(this.db),
			this.db.dataTransfer.findMany({
				where: { kind: DataTransferKind.IMPORT },
				orderBy: { createdAt: "desc" },
				take: DATA_MANAGEMENT.transfers.recentLimit,
			}),
			workspaceRoleOf(userId, this.db),
		]);

		const transferCount = (kind: DataTransferKind) =>
			transfers.find((row) => row.kind === kind)?._count._all ?? 0;

		return {
			summary: {
				totalRecords: contacts + companies + deals + activities,
				importsLast30Days: transferCount(DataTransferKind.IMPORT),
				exportsLast30Days: transferCount(DataTransferKind.EXPORT),
				lastBackupAt: backups[0]?.createdAt.toISOString() ?? null,
			},
			backups: backups.map(toBackupItem),
			retentionDays,
			recentImports: recentImports.map((row) => ({
				id: row.id,
				entity: row.entity,
				filename: row.filename,
				rowCount: row.rowCount,
				failedCount: row.failedCount,
				createdAt: row.createdAt.toISOString(),
			})),
			canManage: isWorkspaceAdmin(role),
		};
	}

	async createBackup(
		userId: string,
		input: CreateBackupInput,
	): Promise<BackupItem> {
		await this.requireManager(userId);

		const limit = DATA_MANAGEMENT.backups.maxRecordsPerType;
		const counts = await Promise.all([
			this.db.contact.count(),
			this.db.company.count(),
			this.db.deal.count(),
			this.db.activity.count(),
		]);

		if (counts.some((count) => count > limit)) {
			throw new BadRequestException(
				`A backup holds at most ${limit} records of each type. Use Export for larger data sets.`,
			);
		}

		const [contacts, companies, deals, activities] = await Promise.all([
			this.db.contact.findMany(),
			this.db.company.findMany(),
			this.db.deal.findMany(),
			this.db.activity.findMany(),
		]);

		const createdAt = new Date();
		const snapshot = JSON.stringify({
			name: input.name,
			createdAt: createdAt.toISOString(),
			contacts,
			companies,
			deals,
			activities,
		});
		const data = new Uint8Array(gzipSync(Buffer.from(snapshot, "utf8")));
		const recordCount =
			contacts.length + companies.length + deals.length + activities.length;

		const backup = await this.db.workspaceBackup.create({
			data: {
				name: input.name,
				recordCount,
				sizeBytes: data.byteLength,
				data,
				createdById: userId,
				createdAt,
			},
			select: BACKUP_SELECT,
		});

		this.logger.log({
			message: "Backup created",
			userId,
			backupId: backup.id,
			recordCount,
			sizeBytes: data.byteLength,
		});

		return toBackupItem(backup);
	}

	async downloadBackup(
		userId: string,
		input: BackupIdInput,
	): Promise<{ filename: string; content: string }> {
		await this.requireManager(userId);

		const backup = await this.db.workspaceBackup.findUnique({
			where: { id: input.id },
			select: { name: true, createdAt: true, data: true },
		});
		if (!backup) throw new NotFoundException("That backup does not exist.");

		const stamp = backup.createdAt.toISOString().slice(0, 10);
		const slug =
			backup.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "") || "backup";

		return {
			filename: `${slug}-${stamp}.json`,
			content: gunzipSync(backup.data).toString("utf8"),
		};
	}

	async deleteBackup(
		userId: string,
		input: BackupIdInput,
	): Promise<{ id: string }> {
		await this.requireManager(userId);

		const { count } = await this.db.workspaceBackup.deleteMany({
			where: { id: input.id },
		});
		if (count === 0) {
			throw new NotFoundException("That backup does not exist.");
		}

		this.logger.log({ message: "Backup deleted", userId, backupId: input.id });

		return { id: input.id };
	}

	async clearDeletedData(
		userId: string,
		input: ClearDeletedDataInput,
	): Promise<{ purged: number; skipped: number; failed: number }> {
		await this.requireManager(userId);

		const entities = input.entity ? [input.entity] : [...DATA_ENTITIES];
		const now = new Date();
		const total = { purged: 0, skipped: 0, failed: 0 };

		for (const entity of entities) {
			for (let round = 0; round < DATA_MANAGEMENT.purge.maxRounds; round += 1) {
				const result = await this.purgeArchived(entity, now);
				total.purged += result.succeeded;
				total.skipped += result.skipped;
				total.failed += result.failed;

				if (
					result.requested < ARCHIVE.prune.maxBatch ||
					result.succeeded === 0
				) {
					break;
				}
			}
		}

		this.logger.log({ message: "Archived records purged", userId, ...total });

		return total;
	}

	async archiveInactiveRecords(
		userId: string,
		input: ArchiveInactiveRecordsInput,
	): Promise<{ contacts: number; deals: number }> {
		await this.requireManager(userId);

		const cutoff = new Date(Date.now() - input.days * DAY_MS);
		const archivedAt = new Date();
		const inactive = {
			archivedAt: null,
			OR: [
				{ lastActivityAt: { lt: cutoff } },
				{ lastActivityAt: null, createdAt: { lt: cutoff } },
			],
		};

		const [contacts, deals] = await this.db.$transaction([
			this.db.contact.updateMany({ where: inactive, data: { archivedAt } }),
			this.db.deal.updateMany({ where: inactive, data: { archivedAt } }),
		]);

		this.logger.log({
			message: "Inactive records archived",
			userId,
			days: input.days,
			contacts: contacts.count,
			deals: deals.count,
		});

		return { contacts: contacts.count, deals: deals.count };
	}

	async exportData(
		userId: string,
		input: EntityInput,
	): Promise<{ csv: string; filename: string; rowCount: number }> {
		const result = await this.exportEntity(input.entity);

		await this.db.dataTransfer.create({
			data: {
				kind: DataTransferKind.EXPORT,
				entity: input.entity,
				filename: result.filename,
				rowCount: result.rowCount,
				userId,
			},
		});

		return result;
	}

	async importData(userId: string, input: ImportDataInput) {
		const result = await this.importEntity(userId, input);

		await this.db.dataTransfer.create({
			data: {
				kind: DataTransferKind.IMPORT,
				entity: input.entity,
				filename: input.filename,
				rowCount: result.created + result.updated,
				failedCount: result.failed,
				userId,
			},
		});

		this.logger.log({
			message: "Data imported",
			userId,
			entity: input.entity,
			created: result.created,
			updated: result.updated,
			failed: result.failed,
		});

		return result;
	}

	importTemplate(input: EntityInput): { csv: string; filename: string } {
		switch (input.entity) {
			case "CONTACT":
				return this.contacts.importTemplate();
			case "COMPANY":
				return this.companies.importTemplate();
			case "DEAL":
				return this.deals.importTemplate();
		}
	}

	async findDuplicates(input: DuplicateEntityInput): Promise<DuplicateGroups> {
		const limit = DATA_MANAGEMENT.duplicates.maxGroups;

		const rows =
			input.entity === "CONTACT"
				? await this.db.$queryRaw<unknown[]>(Prisma.sql`
						SELECT lower(btrim(concat_ws(' ', "firstName", "lastName"))) AS key,
							json_agg(json_build_object(
								'id', id,
								'name', btrim(concat_ws(' ', "firstName", "lastName"))
							) ORDER BY "createdAt") AS records
						FROM "contact"
						WHERE "archivedAt" IS NULL
						GROUP BY 1
						HAVING count(*) > 1
						ORDER BY count(*) DESC, 1
						LIMIT ${limit}
					`)
				: await this.db.$queryRaw<unknown[]>(Prisma.sql`
						SELECT lower(btrim(name)) AS key,
							json_agg(json_build_object('id', id, 'name', btrim(name))
								ORDER BY "createdAt") AS records
						FROM "company"
						WHERE "archivedAt" IS NULL
						GROUP BY 1
						HAVING count(*) > 1
						ORDER BY count(*) DESC, 1
						LIMIT ${limit}
					`);

		return { groups: duplicateRows.parse(rows) };
	}

	private exportEntity(entity: DataEntity) {
		switch (entity) {
			case "CONTACT":
				return this.contacts.exportCsv(contactExportInput.parse({}));
			case "COMPANY":
				return this.companies.exportCsv(companyExportInput.parse({}));
			case "DEAL":
				return this.deals.exportCsv(dealExportInput.parse({}));
		}
	}

	private importEntity(userId: string, input: ImportDataInput) {
		switch (input.entity) {
			case "CONTACT":
				return this.contacts.importCsv({ csv: input.csv });
			case "COMPANY":
				return this.companies.importCsv({ csv: input.csv });
			case "DEAL":
				return this.deals.importCsv({ csv: input.csv }, userId);
		}
	}

	private purgeArchived(entity: DataEntity, before: Date): Promise<BulkResult> {
		switch (entity) {
			case "CONTACT":
				return this.contacts.purgeExpired(before);
			case "COMPANY":
				return this.companies.purgeExpired(before);
			case "DEAL":
				return this.deals.purgeExpired(before);
		}
	}

	private async requireManager(userId: string): Promise<void> {
		const role = await workspaceRoleOf(userId, this.db);

		if (!isWorkspaceAdmin(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can manage workspace data.",
			);
		}
	}
}

function toBackupItem(row: {
	id: string;
	name: string;
	createdAt: Date;
	sizeBytes: number;
	recordCount: number;
}): BackupItem {
	return {
		id: row.id,
		name: row.name,
		createdAt: row.createdAt.toISOString(),
		sizeBytes: row.sizeBytes,
		recordCount: row.recordCount,
	};
}
