import { canManageProducts, workspaceRoleOf } from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import { ProductStatus } from "@crm/db";
import {
	readProductDisplay,
	writeProductDisplay,
} from "@crm/db/products";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type {
	ProductCreateInput,
	ProductDisplayInput,
	ProductListInput,
	ProductUpdateInput,
} from "./products.contracts";
import { PRODUCT_META } from "./products.contracts";

@Injectable()
export class ProductsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	meta() {
		return PRODUCT_META;
	}

	async list(userId: string, input: ProductListInput) {
		const where: Prisma.ProductWhereInput = {
			archivedAt: null,
		};

		if (input.status !== "all") {
			where.status = input.status;
		}

		const q = input.q.trim();
		if (q) {
			where.OR = [
				{ name: { contains: q, mode: "insensitive" } },
				{ shortDescription: { contains: q, mode: "insensitive" } },
				{ category: { contains: q, mode: "insensitive" } },
			];
		}

		const orderBy: Prisma.ProductOrderByWithRelationInput =
			input.sort === "name"
				? { name: "asc" }
				: input.sort === "createdAt"
					? { createdAt: "desc" }
					: { position: "asc" };

		const [rows, total, canManage] = await Promise.all([
			this.db.product.findMany({
				where,
				orderBy: [orderBy, { name: "asc" }],
				select: {
					id: true,
					name: true,
					shortDescription: true,
					detailedDescription: true,
					category: true,
					type: true,
					color: true,
					iconUrl: true,
					status: true,
					isCore: true,
					position: true,
					createdAt: true,
					updatedAt: true,
					_count: {
						select: {
							contacts: { where: { archivedAt: null } },
							deals: { where: { archivedAt: null } },
						},
					},
				},
			}),
			this.db.product.count({ where }),
			this.canManage(userId),
		]);

		const customerCounts = await this.customerCounts(rows.map((row) => row.id));

		return {
			rows: rows.map((row) => ({
				id: row.id,
				name: row.name,
				shortDescription: row.shortDescription,
				detailedDescription: row.detailedDescription,
				category: row.category,
				type: row.type,
				color: row.color,
				iconUrl: row.iconUrl,
				status: row.status,
				isCore: row.isCore,
				position: row.position,
				counts: {
					leads: row._count.contacts,
					deals: row._count.deals,
					customers: customerCounts.get(row.id) ?? 0,
				},
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
			})),
			total,
			canManage,
		};
	}

	async options() {
		const [display, options] = await Promise.all([
			readProductDisplay(this.db),
			this.db.product.findMany({
				where: { archivedAt: null, status: ProductStatus.ACTIVE },
				orderBy: [{ position: "asc" }, { name: "asc" }],
				select: { id: true, name: true, color: true, status: true },
			}),
		]);

		return {
			options,
			defaultProductId: display.defaultProductId,
			showInLeadCreation: display.showInLeadCreation,
			showInCustomerCreation: display.showInCustomerCreation,
			showInDealCreation: display.showInDealCreation,
			allowMultipleOnDeal: display.allowMultipleOnDeal,
		};
	}

	async display(userId: string) {
		const [settings, canManage] = await Promise.all([
			readProductDisplay(this.db),
			this.canManage(userId),
		]);
		return { ...settings, canManage };
	}

	async updateDisplay(userId: string, input: ProductDisplayInput) {
		await this.requireManage(userId);

		if (input.defaultProductId) {
			const product = await this.db.product.findFirst({
				where: {
					id: input.defaultProductId,
					archivedAt: null,
					status: ProductStatus.ACTIVE,
				},
				select: { id: true },
			});
			if (!product) {
				throw new BadRequestException("Default product is not active.");
			}
		}

		const settings = await writeProductDisplay(this.db, input);
		return { ...settings, canManage: true };
	}

	async create(userId: string, input: ProductCreateInput) {
		await this.requireManage(userId);

		const position = await this.nextPosition();
		const created = await this.db.product.create({
			data: {
				name: input.name.trim(),
				shortDescription: input.shortDescription.trim(),
				detailedDescription: blankToNull(input.detailedDescription ?? ""),
				category: input.category.trim(),
				type: input.type.trim(),
				color: input.color.toLowerCase(),
				status: input.status,
				isCore: input.isCore,
				position,
			},
			select: { id: true },
		});

		return this.byId(created.id);
	}

	async update(userId: string, input: ProductUpdateInput) {
		await this.requireManage(userId);

		const existing = await this.db.product.findFirst({
			where: { id: input.id, archivedAt: null },
			select: { id: true },
		});
		if (!existing) throw new NotFoundException("Product not found.");

		const data: Prisma.ProductUpdateInput = {};
		if (input.name !== undefined) data.name = input.name.trim();
		if (input.shortDescription !== undefined) {
			data.shortDescription = input.shortDescription.trim();
		}
		if (input.detailedDescription !== undefined) {
			data.detailedDescription = blankToNull(input.detailedDescription);
		}
		if (input.category !== undefined) data.category = input.category.trim();
		if (input.type !== undefined) data.type = input.type.trim();
		if (input.color !== undefined) data.color = input.color.toLowerCase();
		if (input.status !== undefined) data.status = input.status;
		if (input.isCore !== undefined) data.isCore = input.isCore;

		await this.db.product.update({ where: { id: input.id }, data });
		return this.byId(input.id);
	}

	async archive(userId: string, id: string) {
		await this.requireManage(userId);

		const existing = await this.db.product.findFirst({
			where: { id, archivedAt: null },
			select: { id: true },
		});
		if (!existing) throw new NotFoundException("Product not found.");

		const display = await readProductDisplay(this.db);
		if (display.defaultProductId === id) {
			await writeProductDisplay(this.db, {
				...display,
				defaultProductId: null,
			});
		}

		await this.db.product.update({
			where: { id },
			data: { archivedAt: new Date(), status: ProductStatus.INACTIVE },
		});

		return { id };
	}

	private async byId(id: string) {
		const row = await this.db.product.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				shortDescription: true,
				detailedDescription: true,
				category: true,
				type: true,
				color: true,
				iconUrl: true,
				status: true,
				isCore: true,
				position: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						contacts: { where: { archivedAt: null } },
						deals: { where: { archivedAt: null } },
					},
				},
			},
		});
		if (!row) throw new NotFoundException("Product not found.");

		const customers = await this.customerCounts([id]);

		return {
			id: row.id,
			name: row.name,
			shortDescription: row.shortDescription,
			detailedDescription: row.detailedDescription,
			category: row.category,
			type: row.type,
			color: row.color,
			iconUrl: row.iconUrl,
			status: row.status,
			isCore: row.isCore,
			position: row.position,
			counts: {
				leads: row._count.contacts,
				deals: row._count.deals,
				customers: customers.get(id) ?? 0,
			},
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private async customerCounts(productIds: string[]) {
		const map = new Map<string, number>();
		if (productIds.length === 0) return map;

		const rows = await this.db.contact.groupBy({
			by: ["productId"],
			where: {
				productId: { in: productIds },
				archivedAt: null,
				companyId: { not: null },
			},
			_count: { _all: true },
		});

		for (const row of rows) {
			if (row.productId) map.set(row.productId, row._count._all);
		}
		return map;
	}

	private async nextPosition() {
		const last = await this.db.product.findFirst({
			where: { archivedAt: null },
			orderBy: { position: "desc" },
			select: { position: true },
		});
		return (last?.position ?? -1) + 1;
	}

	private async canManage(userId: string) {
		return canManageProducts(await workspaceRoleOf(userId));
	}

	private async requireManage(userId: string) {
		if (!(await this.canManage(userId))) {
			throw new ForbiddenException("Only owners and admins manage products.");
		}
	}
}

function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}
