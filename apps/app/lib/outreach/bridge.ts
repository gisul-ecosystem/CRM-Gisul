import { z } from "zod";
import { OUTREACH } from "./outreach-config";

export type OutreachRole = "admin" | "member";

type Credentials = { email: string; password: string };

type CachedSession = { cookie: string; expiresAt: number };

let cached: CachedSession | null = null;

const loginResponse = z.object({
	data: z.object({ id: z.string(), email: z.string(), role: z.string() }),
});

export function outreachUrl(): string | null {
	const value = process.env.OUTREACH_URL?.trim();
	return value ? value.replace(/\/+$/, "") : null;
}

function credentials(): Credentials | null {
	const email = process.env.OUTREACH_EMAIL?.trim();
	const password = process.env.OUTREACH_PASSWORD;
	return email && password ? { email, password } : null;
}

export function outreachConfigured(): boolean {
	return Boolean(outreachUrl() && credentials());
}

export function sessionCookieFrom(setCookie: string | null): string | null {
	if (!setCookie) return null;
	const name = OUTREACH.session.cookieName;
	const match = new RegExp(`(?:^|[,;]\\s*)${name}=([^;,\\s]+)`).exec(setCookie);
	return match?.[1] ? `${name}=${match[1]}` : null;
}

export type SessionResult =
	| { ok: true; cookie: string }
	| { ok: false; reason: "unreachable" | "refused" };

export async function outreachSession(
	options: { fresh?: boolean } = {},
): Promise<SessionResult> {
	const base = outreachUrl();
	const login = credentials();
	if (!base || !login) return { ok: false, reason: "refused" };

	if (!options.fresh && cached && cached.expiresAt > Date.now()) {
		return { ok: true, cookie: cached.cookie };
	}

	let response: Response;
	try {
		response = await fetch(`${base}${OUTREACH.session.loginPath}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(login),
		});
	} catch {
		return { ok: false, reason: "unreachable" };
	}

	const parsed = loginResponse.safeParse(
		await response.json().catch(() => null),
	);
	const cookie = sessionCookieFrom(response.headers.get("set-cookie"));
	if (!response.ok || !parsed.success || !cookie) {
		cached = null;
		return { ok: false, reason: "refused" };
	}

	cached = { cookie, expiresAt: Date.now() + OUTREACH.session.reuseMs };
	return { ok: true, cookie };
}

export function forgetOutreachSession(): void {
	cached = null;
}

export function enginePath(crmPathname: string): string | null {
	const { crmPrefix, enginePrefix } = OUTREACH.proxy;
	if (!crmPathname.startsWith(`${crmPrefix}/`)) return null;
	const rest = crmPathname.slice(crmPrefix.length);
	if (rest.split("/").some((segment) => segment === ".." || segment === "."))
		return null;
	return `${enginePrefix}${rest}`;
}

export function adminOnly(enginePathname: string, method: string): boolean {
	const rest = enginePathname.slice(OUTREACH.proxy.enginePrefix.length);
	const [, area = "", , action = ""] = rest.split("/");
	if (!OUTREACH.adminOnlyAreas.some((entry) => entry === area)) return false;
	if (method !== "GET" && method !== "HEAD") return true;
	return area === "domains" && action === "mailboxes";
}
