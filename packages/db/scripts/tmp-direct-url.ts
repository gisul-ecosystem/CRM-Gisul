import { readFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(import.meta.dir, "../../../.env");
const text = readFileSync(envPath, "utf8");
const match = text.match(/DATABASE_URL="([^"]+)"/);
if (!match) {
	console.error("DATABASE_URL missing from .env");
	process.exit(1);
}
const url = new URL(match[1]);
url.port = "5432";
url.searchParams.delete("pgbouncer");
process.stdout.write(url.toString());
