import "../prisma.config.ts";

import { db } from "../src/client";

async function main() {
	const [companies, products, users] = await Promise.all([
		db.company.findMany({
			where: { archivedAt: null },
			select: { name: true },
			orderBy: { name: "asc" },
			take: 10,
		}),
		db.product.findMany({
			where: { archivedAt: null, status: "ACTIVE" },
			select: { name: true },
			orderBy: { name: "asc" },
			take: 10,
		}),
		db.user.findMany({
			select: { email: true, name: true },
			orderBy: { createdAt: "asc" },
			take: 10,
		}),
	]);

	console.log("companies:");
	for (const row of companies) console.log(`- ${row.name}`);
	console.log("products:");
	for (const row of products) console.log(`- ${row.name}`);
	console.log("users:");
	for (const row of users) console.log(`- ${row.email} (${row.name})`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
