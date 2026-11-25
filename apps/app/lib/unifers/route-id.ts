import { UNIFERS } from "./unifers-config";

export function parseUnifersRouteId(id: string): number | null {
	if (!id.startsWith(UNIFERS.routePrefix)) return null;
	const rest = id.slice(UNIFERS.routePrefix.length);
	return /^\d+$/.test(rest) ? Number(rest) : null;
}
