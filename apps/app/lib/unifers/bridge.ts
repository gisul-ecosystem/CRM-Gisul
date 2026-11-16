import { z } from "zod";
import { UNIFERS } from "./unifers-config";

const startRequest = z.object({ startAt: z.string().trim().min(1) });

function trimmed(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

export function unifersKey(): string | null {
	return trimmed("UNIFERS_API_KEY");
}

export function unifersUrl(): string {
	return (trimmed("UNIFERS_API_URL") ?? UNIFERS.defaultUrl).replace(/\/+$/, "");
}

export function unifersWorkspace(): string | null {
	return trimmed("UNIFERS_WORKSPACE_ID");
}

export function upstreamPath(crmPathname: string): string | null {
	const { crmPrefix, upstreamPrefix, allowedRoots } = UNIFERS.proxy;
	if (!crmPathname.startsWith(`${crmPrefix}/`)) return null;
	const segments = crmPathname.slice(crmPrefix.length + 1).split("/");
	if (segments.some((segment) => segment === ".." || segment === "."))
		return null;
	const root = segments[0] ?? "";
	if (!(allowedRoots as readonly string[]).includes(root)) return null;
	return `${upstreamPrefix}/${segments.join("/")}`;
}

export function adminOnly(
	path: string,
	method: string,
	body: unknown,
): boolean {
	const { upstreamPrefix } = UNIFERS.proxy;
	const rest = path.slice(upstreamPrefix.length + 1).split("/");
	const verb = method.toUpperCase();
	if (rest[0] === "email-accounts") return verb !== "GET";
	if (rest[0] !== "campaigns") return false;
	if (rest.length === 3 && rest[2] === "status") return verb === "POST";
	if (rest.length === 1 && verb === "POST") {
		return startRequest.safeParse(body).success;
	}
	return false;
}
