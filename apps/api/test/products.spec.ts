import { ProductStatus } from "@crm/db";
import { describe, expect, it, vi } from "vitest";
import { ProductsService } from "../src/products/products.service";

vi.mock("@crm/auth", () => ({
	workspaceRoleOf: vi.fn().mockResolvedValue("owner"),
	canManageProducts: vi.fn().mockReturnValue(true),
}));

vi.mock("@crm/db/products", () => ({
	readProductDisplay: vi.fn().mockResolvedValue({
		showInLeadCreation: true,
		showInCustomerCreation: true,
		showInDealCreation: true,
		defaultProductId: "prod-1",
		allowMultipleOnDeal: false,
	}),
	writeProductDisplay: vi.fn().mockImplementation((_db, input) => Promise.resolve(input)),
	PRODUCT_CATEGORIES: ["Core Software", "Cloud Infrastructure"],
	PRODUCT_COLORS: ["#5e3da8", "#22c55e", "#ef4444"],
	PRODUCT_TYPES: ["SaaS Platform", "Infrastructure"],
}));

describe("ProductsService", () => {
	const mockDb = {
		product: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			count: vi.fn(),
		},
		contact: {
			groupBy: vi.fn().mockResolvedValue([]),
		},
	} as any;

	const service = new ProductsService(mockDb);

	it("lists products with counts and search filters", async () => {
		mockDb.product.findMany.mockResolvedValue([
			{
				id: "prod-1",
				name: "Aaptor",
				shortDescription: "AI platform",
				detailedDescription: "Detailed description",
				category: "Core Software",
				type: "SaaS Platform",
				color: "#22c55e",
				iconUrl: null,
				status: ProductStatus.ACTIVE,
				isCore: true,
				position: 0,
				createdAt: new Date("2026-01-01"),
				updatedAt: new Date("2026-01-01"),
				_count: { contacts: 124, deals: 36 },
			},
		]);
		mockDb.product.count.mockResolvedValue(1);

		const result = await service.list("user-1", {
			q: "Aaptor",
			status: "all",
			sort: "name",
		});

		expect(result.total).toBe(1);
		expect(result.rows[0]?.name).toBe("Aaptor");
		expect(result.rows[0]?.counts.leads).toBe(124);
		expect(result.rows[0]?.counts.deals).toBe(36);
		expect(result.rows[0]?.counts.customers).toBe(0);
		expect(result.canManage).toBe(true);
	});

	it("creates a new product with position and default active status", async () => {
		mockDb.product.findFirst.mockResolvedValue(null);
		mockDb.product.create.mockResolvedValue({ id: "prod-2" });
		mockDb.product.findUnique.mockResolvedValue({
			id: "prod-2",
			name: "Racko",
			shortDescription: "Cloud platform",
			detailedDescription: null,
			category: "Cloud Infrastructure",
			type: "Infrastructure",
			color: "#ef4444",
			iconUrl: null,
			status: ProductStatus.ACTIVE,
			isCore: true,
			position: 0,
			createdAt: new Date("2026-01-02"),
			updatedAt: new Date("2026-01-02"),
			_count: { contacts: 0, deals: 0 },
		});

		const created = await service.create("user-1", {
			name: "Racko",
			shortDescription: "Cloud platform",
			detailedDescription: "",
			category: "Cloud Infrastructure",
			type: "Infrastructure",
			color: "#ef4444",
			status: ProductStatus.ACTIVE,
			isCore: true,
		});

		expect(created.name).toBe("Racko");
		expect(created.color).toBe("#ef4444");
		expect(mockDb.product.create).toHaveBeenCalled();
	});

	it("updates product fields", async () => {
		mockDb.product.findFirst.mockResolvedValue({ id: "prod-1" });
		mockDb.product.update.mockResolvedValue({ id: "prod-1" });
		mockDb.product.findUnique.mockResolvedValue({
			id: "prod-1",
			name: "Aaptor Pro",
			shortDescription: "AI platform upgraded",
			detailedDescription: null,
			category: "Core Software",
			type: "SaaS Platform",
			color: "#5e3da8",
			iconUrl: null,
			status: ProductStatus.ACTIVE,
			isCore: true,
			position: 0,
			createdAt: new Date("2026-01-01"),
			updatedAt: new Date("2026-01-02"),
			_count: { contacts: 10, deals: 5 },
		});

		const updated = await service.update("user-1", {
			id: "prod-1",
			name: "Aaptor Pro",
			shortDescription: "AI platform upgraded",
		});

		expect(updated.name).toBe("Aaptor Pro");
		expect(mockDb.product.update).toHaveBeenCalled();
	});

	it("archives a product and deactivates it", async () => {
		mockDb.product.findFirst.mockResolvedValue({ id: "prod-1" });
		mockDb.product.update.mockResolvedValue({ id: "prod-1" });

		const result = await service.archive("user-1", "prod-1");
		expect(result.id).toBe("prod-1");
		expect(mockDb.product.update).toHaveBeenCalledWith({
			where: { id: "prod-1" },
			data: expect.objectContaining({ status: ProductStatus.INACTIVE }),
		});
	});

	it("reads and updates display settings", async () => {
		const display = await service.display("user-1");
		expect(display.showInLeadCreation).toBe(true);
		expect(display.canManage).toBe(true);

		mockDb.product.findFirst.mockResolvedValue({ id: "prod-1" });
		const updated = await service.updateDisplay("user-1", {
			showInLeadCreation: true,
			showInCustomerCreation: false,
			showInDealCreation: true,
			defaultProductId: "prod-1",
			allowMultipleOnDeal: true,
		});

		expect(updated.showInCustomerCreation).toBe(false);
		expect(updated.allowMultipleOnDeal).toBe(true);
	});
});
