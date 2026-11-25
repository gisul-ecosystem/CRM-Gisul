import type { AudienceContact } from "@/lib/outreach/schemas/audience";
import { senderNameForAccount } from "./single-send";
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

export type SignOffMailbox = {
	email: string;
	fromName: string | null;
	isDefault: boolean;
};

export type SignOffName =
	| { kind: "name"; name: string }
	| { kind: "mixed"; names: string[] }
	| { kind: "none" };

function firstName(mailbox: SignOffMailbox): string {
	return senderNameForAccount(mailbox).split(/\s+/)[0] ?? "";
}

export function signOffName(
	mailboxes: readonly SignOffMailbox[],
	senders: readonly string[],
): SignOffName {
	const sending = senders.length
		? mailboxes.filter((mailbox) => senders.includes(mailbox.email))
		: mailboxes.filter((mailbox) => mailbox.isDefault);
	const names = [...new Set(sending.map(firstName).filter(Boolean))];
	if (names.length === 1 && names[0]) return { kind: "name", name: names[0] };
	if (names.length > 1) return { kind: "mixed", names };
	return { kind: "none" };
}

export function signEmail(
	body: string,
	ending: { name: string | null; footer: string },
): string {
	const footer = ending.footer.trim();
	let signed = body.trimEnd();
	if (footer && signed.endsWith(footer)) {
		signed = signed.slice(0, -footer.length).trimEnd();
	}
	const signature = ending.name ? `${UNIFERS.signOff}\n${ending.name}` : "";
	const named =
		!signature ||
		signed.includes(UNIFERS.senderPlaceholder) ||
		signed.endsWith(signature);
	if (!named) signed = `${signed}\n\n${signature}`;
	if (!footer) return signed;
	const underName = signature !== "" && signed.endsWith(signature);
	return `${signed}${underName ? "\n" : "\n\n"}${footer}`;
}
