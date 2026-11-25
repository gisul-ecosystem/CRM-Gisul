import "../prisma.config.ts";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/client";

const MIGRATION = "20261006100000_products_and_lead_fields";
const SQL_PATH = join(
	import.meta.dirname,
	"..",
	"prisma",
	"migrations",
	MIGRATION,
	"migration.sql",
);

async function main() {
	const exists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'product'
		) AS "exists"`,
	);

	const already = Boolean(exists[0]?.exists);
	console.log(already ? "product table exists" : "product table missing");

	if (!already) {
		const sql = readFileSync(SQL_PATH, "utf8");
		const statements = sql
			.split(/;\s*\n/)
			.map((part) => part.trim())
			.filter((part) => part.length > 0 && !part.startsWith("--"));

		for (const statement of statements) {
			console.log(`exec: ${statement.slice(0, 72).replace(/\s+/g, " ")}…`);
			await db.$executeRawUnsafe(`${statement};`);
		}
		console.log("SQL applied");
	}

	const recorded = await db.$queryRawUnsafe<{ id: string }[]>(
		`SELECT id FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`,
		MIGRATION,
	);

	if (recorded.length === 0) {
		await db.$executeRawUnsafe(
			`INSERT INTO "_prisma_migrations" (
				id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
			) VALUES (
				$1, $2, NOW(), $3, NULL, NULL, NOW(), 1
			)`,
			crypto.randomUUID(),
			"manual-apply-products-migration",
			MIGRATION,
		);
		console.log("migration row recorded");
	} else {
		console.log("migration row already present");
	}

	const columns = await db.$queryRawUnsafe<{ column_name: string }[]>(
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = 'contact'
		 AND column_name IN ('productId', 'leadStatus', 'leadSource', 'nextFollowUpAt')
		 ORDER BY column_name`,
	);
	console.log(`contact columns: ${columns.map((c) => c.column_name).join(", ")}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
