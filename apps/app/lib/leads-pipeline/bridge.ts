import { LEADS_PIPELINE } from "./pipeline-config";

export function pipelineUrl(): string | null {
	const value = process.env.LEADS_PIPELINE_URL?.trim();
	return value ? value.replace(/\/+$/, "") : null;
}

export function pipelineViewerSrc(): string | null {
	const value = process.env.LEADS_PIPELINE_VIEWER_URL?.trim().replace(
		/\/+$/,
		"",
	);
	if (!value) return null;
	let base: URL;
	try {
		base = new URL(value);
	} catch {
		return null;
	}
	const { page, params, socketPath } = LEADS_PIPELINE.viewer;
	const prefix = base.pathname.replace(/^\/+|\/+$/g, "");
	const query = new URLSearchParams({
		...params,
		path: prefix ? `${prefix}/${socketPath}` : socketPath,
	});
	return `${value}/${page}?${query.toString()}`;
}

export function upstreamPath(crmPathname: string): string | null {
	const { crmPrefix, upstreamPrefix } = LEADS_PIPELINE.proxy;
	if (!crmPathname.startsWith(`${crmPrefix}/`)) return null;
	const rest = crmPathname.slice(crmPrefix.length);
	if (rest.split("/").some((segment) => segment === ".." || segment === "."))
		return null;
	return `${upstreamPrefix}${rest}`;
}
