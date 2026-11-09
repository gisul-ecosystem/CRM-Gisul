import { LEADS_PIPELINE } from "./pipeline-config";

export function pipelineUrl(): string | null {
	const value = process.env.LEADS_PIPELINE_URL?.trim();
	return value ? value.replace(/\/+$/, "") : null;
}

export function upstreamPath(crmPathname: string): string | null {
	const { crmPrefix, upstreamPrefix } = LEADS_PIPELINE.proxy;
	if (!crmPathname.startsWith(`${crmPrefix}/`)) return null;
	const rest = crmPathname.slice(crmPrefix.length);
	if (rest.split("/").some((segment) => segment === ".." || segment === "."))
		return null;
	return `${upstreamPrefix}${rest}`;
}
