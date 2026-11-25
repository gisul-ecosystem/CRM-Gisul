import { connection } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(): Promise<Response> {
	await connection();
	const session = await getSession();
	return new Response(null, {
		status: session ? 204 : 401,
		headers: { "cache-control": "no-store" },
	});
}
