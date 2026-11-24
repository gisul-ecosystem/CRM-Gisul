import type { AudienceContact } from "@/lib/outreach/schemas/audience";
import { UNIFERS } from "./unifers-config";

export type AudienceFields = {
	placeholders: string[];
	titles: string[];
	companies: string[];
};

function mostCommon(values: string[], max: number): string[] {
	const counts = new Map<string, number>();
	for (const value of values) {
		const key = value.trim();
		if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, max)
		.map(([value]) => value);
}

export function audienceFields(
	contacts: AudienceContact[] | null,
): AudienceFields {
	if (!contacts) {
		return {
			placeholders: [UNIFERS.draft.firstName, UNIFERS.draft.company],
			titles: [],
			companies: [],
		};
	}
	const companies = mostCommon(
		contacts.map((contact) => contact.company),
		UNIFERS.draft.maxSamples,
	);
	return {
		placeholders: [
			UNIFERS.draft.firstName,
			...(companies.length ? [UNIFERS.draft.company] : []),
		],
		titles: mostCommon(
			contacts.map((contact) => contact.title),
			UNIFERS.draft.maxSamples,
		),
		companies,
	};
}

export function withSignOff(body: string): string {
	if (body.includes(UNIFERS.senderPlaceholder)) return body;
	return `${body.trimEnd()}\n\n${UNIFERS.signOff}`;
}
