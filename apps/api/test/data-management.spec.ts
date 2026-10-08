import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../src/workspace/workspace.service";

describe("WorkspaceService Data Management", () => {
	const mockDb = {
		organization: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		member: {
			findUnique: vi.fn().mockResolvedValue({ role: "owner" }),
			findMany: vi.fn().mockResolvedValue([]),
			findFirst: vi.fn(),
			groupBy: vi.fn().mockResolvedValue([]),
			count: vi.fn().mockResolvedValue(1),
		},
		contact: {
			count: vi.fn().mockResolvedValue(4200),
		},
		company: {
			count: vi.fn().mockResolvedValue(1800),
		},
		deal: {
			count: vi.fn().mockResolvedValue(2548),
		},
		activity: {
			count: vi.fn().mockResolvedValue(4000),
		},
	};

	const mockAgent = {
		workspaceChanged: vi.fn().mockResolvedValue(undefined),
	} as any;

	it("retrieves data management overview with live total records count and backups", async () => {
		mockDb.organization.findUnique.mockResolvedValueOnce({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const result = await service.dataManagement("u-1");

		expect(result.summary.totalRecords).toBe(12548);
		expect(result.summary.importsCount).toBe(0);
		expect(result.summary.exportsCount).toBe(0);
		expect(result.summary.lastBackupStatus).toBe("Not run");
		expect(result.summary.lastBackupDate).toBe("Never");

		expect(result.backups.length).toBe(0);
		expect(result.retention.deletedLeads).toBe("Keep for 60 days");
		expect(result.retention.deletedCustomers).toBe("Keep for 1 year");
	});

	it("creates and deletes backup entries", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const created = await service.createBackup("u-1", {
			name: "Manual Pre-Deploy Backup",
		});

		expect(created.name).toBe("Manual Pre-Deploy Backup");
		expect(created.status).toBe("Success");
		expect(mockDb.organization.update).toHaveBeenCalled();

		const deleted = await service.deleteBackup("u-1", { id: created.id });
		expect(deleted.success).toBe(true);
	});

	it("updates data retention settings", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const updated = await service.updateDataRetention("u-1", {
			deletedLeads: "Keep for 90 days",
			deletedDeals: "Keep for 2 years",
		});

		expect(mockDb.organization.update).toHaveBeenCalled();
	});

	it("handles data exports, imports, clear trash, and archive", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			slug: "gisul-crm",
			name: "GISUL CRM",
			metadata: null,
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const exported = await service.exportData("u-1", {
			dataType: "Customers",
			dateRange: "Last 30 days",
			includeFields: "all",
		});
		expect(exported.downloadUrl).toContain("customers");

		const imported = await service.importData("u-1", {
			dataType: "Leads",
			filename: "leads_october.csv",
		});
		expect(imported.success).toBe(true);

		const cleared = await service.clearDeletedData("u-1", { type: "all" });
		expect(cleared.clearedCount).toBeGreaterThan(0);

		const archived = await service.archiveInactiveRecords("u-1", {
			period: "90_days",
		});
		expect(archived.archivedCount).toBeGreaterThan(0);
	});

	it("validates delete account conditions", async () => {
		const service = new WorkspaceService(mockDb as any, mockAgent);

		await expect(
			service.deleteAccount("u-1", {
				password: "password123",
				understandIrreversible: false,
			}),
		).rejects.toThrow("Please confirm that you understand");

		const result = await service.deleteAccount("u-1", {
			password: "password123",
			understandIrreversible: true,
		});
		expect(result.success).toBe(true);
	});
});
