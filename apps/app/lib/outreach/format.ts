export const COUNT = new Intl.NumberFormat("en-US");

export const DATE_TIME: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

export const DATE_ONLY: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
};

export const TIME_ONLY: Intl.DateTimeFormatOptions = {
	hour: "numeric",
	minute: "2-digit",
};

export function personName(person: {
	firstName?: string;
	lastName?: string;
	email: string;
}): string {
	const name = [person.firstName, person.lastName]
		.filter((part) => part?.trim())
		.join(" ");
	return name || person.email;
}

export function plural(count: number, one: string, many: string): string {
	return `${COUNT.format(count)} ${count === 1 ? one : many}`;
}

export function gapLabel(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function keyed<T>(
	items: readonly T[],
	prefix: string,
): { id: string; item: T; position: number }[] {
	return items.map((item, position) => ({
		id: `${prefix}-${position}`,
		item,
		position,
	}));
}
