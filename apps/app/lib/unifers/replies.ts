export function campaignStart(createdAt: string | null): string | null {
	if (!createdAt) return null;
	const time = new Date(createdAt).getTime();
	return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
