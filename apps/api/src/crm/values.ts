import type { Prisma } from "@crm/db";
import { Prisma as PrismaNamespace } from "@crm/db";

export function toCents(
	amount: Prisma.Decimal | number | string | null | undefined,
): number | null {
	if (amount === null || amount === undefined) return null;
	if (typeof amount === "number") return Math.round(amount * 100);
	if (typeof amount === "string") return Math.round(parseFloat(amount) * 100);
	if (typeof (amount as any).times === "function") {
		return (amount as Prisma.Decimal).times(100).toNumber();
	}
	return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number | null | undefined): number | null {
	return cents === null || cents === undefined ? null : cents / 100;
}

export function decimalFromCents(
	cents: number | null | undefined,
): Prisma.Decimal | null {
	return cents === null || cents === undefined
		? null
		: new PrismaNamespace.Decimal(cents).dividedBy(100);
}

export function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

export function normalizeEmail(value: string): string | null {
	return blankToNull(value)?.toLowerCase() ?? null;
}
