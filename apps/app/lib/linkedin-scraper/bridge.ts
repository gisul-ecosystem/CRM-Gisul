import { LINKEDIN_SCRAPER } from "./scraper-config";

function trimmed(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value.replace(/\/+$/, "") : null;
}

export function scraperUrl(): string | null {
	return trimmed("LINKEDIN_SCRAPER_URL");
}

export function scraperViewerUrl(): string | null {
	return trimmed("LINKEDIN_SCRAPER_VIEWER_URL");
}

export function upstreamPath(crmPathname: string): string | null {
	const { crmPrefix, upstreamPrefix } = LINKEDIN_SCRAPER.proxy;
	if (!crmPathname.startsWith(`${crmPrefix}/`)) return null;
	const rest = crmPathname.slice(crmPrefix.length);
	if (rest.split("/").some((segment) => segment === ".." || segment === "."))
		return null;
	return `${upstreamPrefix}${rest}`;
}
