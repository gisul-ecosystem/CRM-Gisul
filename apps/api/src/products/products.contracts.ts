import { LeadSource, LeadStatus, ProductStatus } from "@crm/db";
import {
	PRODUCT_CATEGORIES,
	PRODUCT_COLORS,
	PRODUCT_TYPES,
} from "@crm/db/products";
import { z } from "zod";

export const productStatusEnum = z.enum(
	Object.values(ProductStatus) as [ProductStatus, ...ProductStatus[]],
);

export const leadStatusEnum = z.enum(
	Object.values(LeadStatus) as [LeadStatus, ...LeadStatus[]],
);

export const leadSourceEnum = z.enum(
	Object.values(LeadSource) as [LeadSource, ...LeadSource[]],
);

const productColor = z
	.string()
	.trim()
	.toLowerCase()
	.refine(
		(value): value is (typeof PRODUCT_COLORS)[number] =>
			(PRODUCT_COLORS as readonly string[]).includes(value),
		"Pick a colour from the palette.",
	);

const productLogoInput = z.object({
	contentType: z.enum([
		"image/png",
		"image/jpeg",
		"image/webp",
		"image/gif",
		"image/svg+xml",
	]),
	dataBase64: z.string().trim().min(1).max(700_000),
});

export const productCreateInput = z.object({
	name: z.string().trim().min(1, "A product needs a name.").max(80),
	shortDescription: z
		.string()
		.trim()
		.min(1, "Add a short description.")
		.max(150),
	detailedDescription: z.string().trim().max(500).optional().or(z.literal("")),
	category: z.string().trim().min(1, "Choose a category.").max(60),
	type: z.string().trim().min(1, "Choose a type.").max(60),
	color: productColor,
	status: productStatusEnum.default(ProductStatus.ACTIVE),
	isCore: z.boolean().default(false),
	logo: productLogoInput.optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateInput>;

export const productUpdateInput = productCreateInput.partial().extend({
	id: z.string().min(1),
	logo: productLogoInput.nullable().optional(),
});

export type ProductUpdateInput = z.infer<typeof productUpdateInput>;

export const productIdInput = z.object({ id: z.string().min(1) });

export const productListInput = z.object({
	q: z.string().trim().optional().default(""),
	status: z.enum(["all", "ACTIVE", "INACTIVE"]).default("all"),
	sort: z.enum(["name", "createdAt", "position"]).default("position"),
});

export type ProductListInput = z.infer<typeof productListInput>;

export const productCountsOutput = z.object({
	leads: z.number(),
	deals: z.number(),
	customers: z.number(),
});

export const productRowOutput = z.object({
	id: z.string(),
	name: z.string(),
	shortDescription: z.string(),
	detailedDescription: z.string().nullable(),
	category: z.string(),
	type: z.string(),
	color: z.string(),
	iconUrl: z.string().nullable(),
	status: productStatusEnum,
	isCore: z.boolean(),
	position: z.number(),
	counts: productCountsOutput,
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const productListOutput = z.object({
	rows: z.array(productRowOutput),
	total: z.number(),
	canManage: z.boolean(),
});

export const productOptionOutput = z.object({
	id: z.string(),
	name: z.string(),
	color: z.string(),
	iconUrl: z.string().nullable(),
	status: productStatusEnum,
});

export const productOptionsOutput = z.object({
	options: z.array(productOptionOutput),
	defaultProductId: z.string().nullable(),
	showInLeadCreation: z.boolean(),
	showInCustomerCreation: z.boolean(),
	showInDealCreation: z.boolean(),
	allowMultipleOnDeal: z.boolean(),
});

export const productDisplayInput = z.object({
	showInLeadCreation: z.boolean(),
	showInCustomerCreation: z.boolean(),
	showInDealCreation: z.boolean(),
	defaultProductId: z.string().nullable(),
	allowMultipleOnDeal: z.boolean(),
});

export type ProductDisplayInput = z.infer<typeof productDisplayInput>;

export const productDisplayOutput = productDisplayInput.extend({
	canManage: z.boolean(),
});

export const productMetaOutput = z.object({
	colors: z.array(z.string()),
	categories: z.array(z.string()),
	types: z.array(z.string()),
});

export const PRODUCT_META = {
	colors: [...PRODUCT_COLORS],
	categories: [...PRODUCT_CATEGORIES],
	types: [...PRODUCT_TYPES],
} as const;
