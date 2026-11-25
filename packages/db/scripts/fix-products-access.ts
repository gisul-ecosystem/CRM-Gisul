import "../prisma.config.ts";

import { WORKSPACE_ID } from "../src/workspace";
import { db } from "../src/client";

async function main() {
	const products = await db.product.findMany({
		where: { archivedAt: null },
		select: { id: true, name: true },
		orderBy: { name: "asc" },
	});
	console.log(
		`products=${products.length} ${products.map((row) => row.name).join(",")}`,
	);

	const archived = await db.product.updateMany({
		where: { archivedAt: null },
		data: { archivedAt: new Date(), status: "INACTIVE" },
	});
	console.log(`archived=${archived.count}`);

	const members = await db.member.findMany({
		where: { organizationId: WORKSPACE_ID },
		select: {
			id: true,
			role: true,
			user: { select: { id: true, email: true, name: true } },
		},
		orderBy: { createdAt: "asc" },
	});
	for (const member of members) {
		console.log(`member ${member.user.email} role=${member.role}`);
	}

	const owners = members.filter((member) => member.role === "owner");
	if (owners.length === 0 && members[0]) {
		await db.member.update({
			where: { id: members[0].id },
			data: { role: "owner" },
		});
		console.log(`promoted ${members[0].user.email} to owner`);
	}

	for (const member of members) {
		if (member.role === "member") {
			await db.member.update({
				where: { id: member.id },
				data: { role: "admin" },
			});
			console.log(`promoted ${member.user.email} to admin`);
		}
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
