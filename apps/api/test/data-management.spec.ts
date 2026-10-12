import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import type { CompaniesService } from "../src/companies/companies.service";
import type { ContactsService } from "../src/contacts/contacts.service";
import type { BulkResult } from "../src/crm/bulk";
import type { DealsService } from "../src/deals/deals.service";
import { DataManagementService } from "../src/workspace/data-management.service";

type StoredBackup = {
	id: string;
	name: string;
	recordCount: number;
	sizeBytes: number;
	data: Uint8Array;
	createdAt: Date;
};

type UpdateManyArgs = { data: { archivedAt: Date } };

function bulk(succeeded: number, requested = succeeded): BulkResult {
	return { requested, succeeded, skipped: 0, failed: 0, message: null };
}

function buildService(role: "owner" | "member" = "owner") {
	const backups: StoredBackup[] = [];
	const transfers: { kind: string; entity: string; rowCount: number }[] = [];
	const updateManyCalls: UpdateManyArgs[] = [];
	const purgeCalls: string[] = [];
	const purgeBatches = [bulk(500), bulk(3, 3)];

	const db = {
		member: {
			async findUnique() {
				return { role };
			},
		},
		appSetting: {
			async findUnique() {
				return { archiveRetentionDays: 90 };
			},
		},
		contact: {
			async count(args?: { where?: { archivedAt: null } }) {
				return args?.where ? 10 : 12;
			},
			async findMany() {
				return [{ id: "c1", firstName: "Ada" }];
			},
			async updateMany(args: UpdateManyArgs) {
				updateManyCalls.push(args);
				return { count: 4 };
			},
		},
		company: {
			async count() {
				return 5;
			},
			async findMany() {
				return [];
			},
		},
		deal: {
			async count() {
				return 3;
			},
			async findMany() {
				return [];
			},
			async updateMany(args: UpdateManyArgs) {
				updateManyCalls.push(args);
				return { count: 2 };
			},
		},
		activity: {
			async count() {
				return 7;
			},
			async findMany() {
				return [];
			},
		},
		dataTransfer: {
			async groupBy() {
				return [
					{ kind: "IMPORT", _count: { _all: 2 } },
					{ kind: "EXPORT", _count: { _all: 1 } },
				];
			},
			async findMany() {
				return [];
			},
			async create(args: {
				data: { kind: string; entity: string; rowCount: number };
			}) {
				transfers.push(args.data);
				return args.data;
			},
		},
		workspaceBackup: {
			async findMany() {
				return backups.map(({ data: _data, ...rest }) => rest);
			},
			async create(args: { data: Omit<StoredBackup, "id"> }) {
				const row = { id: `b${backups.length + 1}`, ...args.data };
				backups.push(row);
				const { data: _data, ...rest } = row;
				return rest;
			},
			async findUnique(args: { where: { id: string } }) {
				return backups.find((row) => row.id === args.where.id) ?? null;
			},
			async deleteMany(args: { where: { id: string } }) {
				const index = backups.findIndex((row) => row.id === args.where.id);
				if (index >= 0) backups.splice(index, 1);
				return { count: index >= 0 ? 1 : 0 };
			},
		},
		async $transaction(operations: Promise<unknown>[]) {
			return Promise.all(operations);
		},
		async $queryRaw() {
			return [
				{
					key: "ada lovelace",
					records: [
						{ id: "c1", name: "Ada Lovelace" },
						{ id: "c2", name: "Ada Lovelace" },
					],
				},
			];
		},
	} as unknown as Db;

	const contacts = {
		async purgeExpired() {
			purgeCalls.push("CONTACT");
			return purgeBatches.shift() ?? bulk(0, 0);
		},
		async importCsv() {
			return { created: 3, updated: 1, failed: 2, errors: [] };
		},
		importTemplate() {
			return { csv: "firstName", filename: "leads.csv" };
		},
	} as unknown as ContactsService;
	const companies = {
		async purgeExpired() {
			purgeCalls.push("COMPANY");
			return bulk(0, 0);
		},
	} as unknown as CompaniesService;
	const deals = {
		async purgeExpired() {
			purgeCalls.push("DEAL");
			return bulk(1, 1);
		},
	} as unknown as DealsService;

	return {
		service: new DataManagementService(db, contacts, companies, deals),
		transfers,
		updateManyCalls,
		purgeCalls,
	};
}

describe("DataManagementService", () => {
	it("reports live counts, transfer totals and the real retention setting", async () => {
		const { service } = buildService();
		const overview = await service.overview("u-1");

		expect(overview.summary.totalRecords).toBe(10 + 5 + 3 + 7);
		expect(overview.summary.importsLast30Days).toBe(2);
		expect(overview.summary.exportsLast30Days).toBe(1);
		expect(overview.summary.lastBackupAt).toBeNull();
		expect(overview.retentionDays).toBe(90);
		expect(overview.canManage).toBe(true);
	});

	it("stores a real snapshot and returns it on download", async () => {
		const { service } = buildService();
		const backup = await service.createBackup("u-1", { name: "Before import" });

		expect(backup.recordCount).toBe(1);
		expect(backup.sizeBytes).toBeGreaterThan(0);

		const file = await service.downloadBackup("u-1", { id: backup.id });
		const snapshot = JSON.parse(file.content);

		expect(file.filename.startsWith("before-import-")).toBe(true);
		expect(snapshot.contacts).toEqual([{ id: "c1", firstName: "Ada" }]);

		await service.deleteBackup("u-1", { id: backup.id });
		await expect(
			service.downloadBackup("u-1", { id: backup.id }),
		).rejects.toThrow("That backup does not exist.");
	});

	it("refuses data changes from a member", async () => {
		const { service } = buildService("member");

		await expect(service.createBackup("u-2", { name: "Nope" })).rejects.toThrow(
			"Only an owner or an admin can manage workspace data.",
		);
		await expect(
			service.clearDeletedData("u-2", { entity: null }),
		).rejects.toThrow("Only an owner or an admin can manage workspace data.");
	});

	it("purges archived records in batches until each type is empty", async () => {
		const { service, purgeCalls } = buildService();
		const result = await service.clearDeletedData("u-1", { entity: null });

		expect(purgeCalls).toEqual(["CONTACT", "CONTACT", "COMPANY", "DEAL"]);
		expect(result).toEqual({ purged: 504, skipped: 0, failed: 0 });
	});

	it("archives leads and deals with no activity inside the window", async () => {
		const { service, updateManyCalls } = buildService();
		const result = await service.archiveInactiveRecords("u-1", { days: 90 });

		expect(result).toEqual({ contacts: 4, deals: 2 });
		expect(updateManyCalls).toHaveLength(2);
	});

	it("imports through the real CSV importer and logs the transfer", async () => {
		const { service, transfers } = buildService();
		const result = await service.importData("u-1", {
			entity: "CONTACT",
			csv: "firstName\nAda",
			filename: "leads.csv",
		});

		expect(result.created).toBe(3);
		expect(transfers).toEqual([
			expect.objectContaining({
				kind: "IMPORT",
				entity: "CONTACT",
				rowCount: 4,
			}),
		]);
	});

	it("returns duplicate groups parsed from the query", async () => {
		const { service } = buildService();
		const result = await service.findDuplicates({ entity: "CONTACT" });

		expect(result.groups).toHaveLength(1);
		expect(result.groups[0]?.records).toHaveLength(2);
	});
});
