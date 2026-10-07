import type { Db } from "./client";

export const PRODUCT_COLORS = [
	"#1a9b6a",
	"#e0455a",
	"#8a4fd0",
	"#4a63d6",
	"#e0a21a",
	"#e0457f",
	"#5a5a66",
] as const;

export const PRODUCT_CATEGORIES = [
	"Core Product",
	"Add-on",
	"Service",
	"Platform",
] as const;

export const PRODUCT_TYPES = [
	"SaaS",
	"Platform",
	"Service",
	"Other",
] as const;

export type ProductDisplaySettings = {
	showInLeadCreation: boolean;
	showInCustomerCreation: boolean;
	showInDealCreation: boolean;
	defaultProductId: string | null;
	allowMultipleOnDeal: boolean;
};

export const DEFAULT_PRODUCT_DISPLAY: ProductDisplaySettings = {
	showInLeadCreation: true,
	showInCustomerCreation: true,
	showInDealCreation: true,
	defaultProductId: null,
	allowMultipleOnDeal: false,
};

export async function readProductDisplay(
	db: Db,
): Promise<ProductDisplaySettings> {
	const row = await db.appSetting.findUnique({
		where: { id: "app" },
		select: {
			productShowInLeadCreation: true,
			productShowInCustomerCreation: true,
			productShowInDealCreation: true,
			productDefaultId: true,
			productAllowMultipleOnDeal: true,
		},
	});

	if (!row) return DEFAULT_PRODUCT_DISPLAY;

	return {
		showInLeadCreation: row.productShowInLeadCreation,
		showInCustomerCreation: row.productShowInCustomerCreation,
		showInDealCreation: row.productShowInDealCreation,
		defaultProductId: row.productDefaultId,
		allowMultipleOnDeal: row.productAllowMultipleOnDeal,
	};
}

export async function writeProductDisplay(
	db: Db,
	settings: ProductDisplaySettings,
): Promise<ProductDisplaySettings> {
	const fields = {
		productShowInLeadCreation: settings.showInLeadCreation,
		productShowInCustomerCreation: settings.showInCustomerCreation,
		productShowInDealCreation: settings.showInDealCreation,
		productDefaultId: settings.defaultProductId,
		productAllowMultipleOnDeal: settings.allowMultipleOnDeal,
	};

	await db.appSetting.upsert({
		where: { id: "app" },
		create: { id: "app", ...fields },
		update: fields,
	});

	return settings;
}
