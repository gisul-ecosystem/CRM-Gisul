import "../prisma.config.ts";

import { db } from "../src/client";
import { ProductStatus } from "../src/generated/prisma/enums";
import { PRODUCT_COLORS } from "../src/products";

const defaults = [
	{
		name: "Aaptor",
		shortDescription:
			"AI-powered capability assessment and development platform.",
		category: "Core Product",
		type: "Platform",
		color: PRODUCT_COLORS[0],
		isCore: true,
		position: 0,
	},
	{
		name: "Racko",
		shortDescription:
			"Cloud infrastructure platform for virtual machines, compute, and storage.",
		category: "Core Product",
		type: "Platform",
		color: PRODUCT_COLORS[1],
		isCore: true,
		position: 1,
	},
	{
		name: "KanonKode",
		shortDescription:
			"Learning and workforce development platform for continuous skill growth.",
		category: "Core Product",
		type: "SaaS",
		color: PRODUCT_COLORS[2],
		isCore: true,
		position: 2,
	},
] as const;

async function main() {
	let created = 0;
	for (const product of defaults) {
		const existing = await db.product.findFirst({
			where: { name: product.name, archivedAt: null },
			select: { id: true },
		});
		if (existing) {
			console.log(`exists ${product.name}`);
			continue;
		}
		await db.product.create({
			data: { ...product, status: ProductStatus.ACTIVE },
		});
		console.log(`created ${product.name}`);
		created += 1;
	}
	console.log(`createdCount=${created}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
