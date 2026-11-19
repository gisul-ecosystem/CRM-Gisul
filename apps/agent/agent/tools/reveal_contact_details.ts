import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { enabled, UNIFERS, unavailable } from "../lib/capabilities";
import { writeTimelineNote } from "../lib/crm";
import { focusOn, spend } from "../lib/focus";
import { assertResearchPurpose } from "../lib/session-purpose";
import { type RevealResult, revealContacts } from "../lib/unifers";
import { UNIFERS as CONFIG } from "../lib/unifers-config";

const NOTE_SUBJECT = "Unifers contact reveal";

function blank(value: string | null): boolean {
	return !value?.trim();
}

async function lastReveal(contactId: string): Promise<Date | null> {
	const row = await db.activity.findFirst({
		where: {
			contactId,
			meta: { path: ["kind"], equals: CONFIG.reveal.noteKind },
			occurredAt: { gte: new Date(Date.now() - CONFIG.reveal.repeatAfterMs) },
		},
		orderBy: { occurredAt: "desc" },
		select: { occurredAt: true },
	});
	return row?.occurredAt ?? null;
}

function pickEmail(result: RevealResult): string | null {
	const work = result.peopleData.professionalEmails.find((email) =>
		email.includes("@"),
	);
	if (work) return work.trim().toLowerCase();
	if (!CONFIG.reveal.usePersonalEmail) return null;
	const personal = result.peopleData.personalEmails.find((email) =>
		email.includes("@"),
	);
	return personal ? personal.trim().toLowerCase() : null;
}

async function emailHeldElsewhere(
	contactId: string,
	email: string,
): Promise<boolean> {
	const other = await db.contact.findFirst({
		where: {
			id: { not: contactId },
			email: { equals: email, mode: "insensitive" },
			archivedAt: null,
		},
		select: { id: true },
	});
	return other !== null;
}

async function fillEmail(contactId: string, email: string): Promise<boolean> {
	const { count } = await db.contact.updateMany({
		where: { id: contactId, OR: [{ email: null }, { email: "" }] },
		data: { email },
	});
	return count > 0;
}

async function fillPhone(contactId: string, phone: string): Promise<boolean> {
	const { count } = await db.contact.updateMany({
		where: { id: contactId, OR: [{ phone: null }, { phone: "" }] },
		data: { phone },
	});
	return count > 0;
}

export default defineTool({
	description:
		"Find a contact's work email and mobile number through Unifers, from the LinkedIn URL already on the record. Asks only for what the contact is missing, writes only into empty fields, and never overwrites a value a person entered. Costs Unifers credits: call it once per contact, after the LinkedIn URL is settled, and only when the email or phone is empty.",
	inputSchema: z.object({
		contactId: z.string(),
	}),
	async execute({ contactId }, ctx) {
		assertResearchPurpose(ctx);
		focusOn({ contactId });

		if (!(await enabled(UNIFERS))) {
			return { revealed: false as const, ...unavailable(UNIFERS) };
		}

		const contact = await db.contact.findUnique({
			where: { id: contactId },
			select: { email: true, phone: true, linkedinUrl: true },
		});
		if (!contact) {
			return { revealed: false as const, reason: "No contact with that id." };
		}
		if (!contact.linkedinUrl?.trim()) {
			return {
				revealed: false as const,
				reason:
					"This contact has no LinkedIn URL. Settle it first with resolve_linkedin_profile or get_linkedin_profile.",
			};
		}

		const want = { email: blank(contact.email), phone: blank(contact.phone) };
		if (!want.email && !want.phone) {
			return {
				revealed: false as const,
				reason: "The contact already has an email and a phone.",
			};
		}

		const last = await lastReveal(contactId);
		if (last) {
			return {
				revealed: false as const,
				reason: `Unifers was already asked about this contact on ${last.toISOString().slice(0, 10)}. Do not ask again.`,
			};
		}

		const charge = spend(CONFIG.callCost);
		if (!charge.ok) return { revealed: false as const, reason: charge.reason };

		const call = await revealContacts(contact.linkedinUrl, want);

		if (call.outcome === "failed") {
			if (call.status === 404) {
				await writeTimelineNote(
					contactId,
					NOTE_SUBJECT,
					"Unifers found no email or phone for this LinkedIn profile.",
					{ kind: CONFIG.reveal.noteKind, outcome: "not_found" },
				);
			}
			return {
				revealed: false as const,
				reason: call.reason,
				code: call.code ?? undefined,
				retryable: call.retryable,
			};
		}

		const result = call.data;
		const lines: string[] = [];
		const written: { email?: string; phone?: string } = {};

		if (want.email) {
			const email = pickEmail(result);
			if (!email) {
				lines.push(`Email: ${result.fields.email ?? "not_found"}.`);
			} else if (await emailHeldElsewhere(contactId, email)) {
				lines.push(
					`Email: ${email} — not saved, another contact already uses it.`,
				);
			} else if (await fillEmail(contactId, email)) {
				written.email = email;
				lines.push(`Email: ${email} — saved.`);
			} else {
				lines.push(
					`Email: ${email} — not saved, someone filled the field first.`,
				);
			}
		}

		if (want.phone) {
			const phone = result.peopleData.mobiles.find((value) => value.trim());
			if (!phone) {
				lines.push(`Phone: ${result.fields.phone ?? "not_found"}.`);
			} else if (await fillPhone(contactId, phone.trim())) {
				written.phone = phone.trim();
				lines.push(`Phone: ${phone.trim()} — saved.`);
			} else {
				lines.push(
					`Phone: ${phone.trim()} — not saved, someone filled the field first.`,
				);
			}
		}

		const others = [
			...result.peopleData.professionalEmails,
			...result.peopleData.personalEmails,
			...result.peopleData.mobiles,
		].filter((value) => value !== written.email && value !== written.phone);
		if (others.length > 0) lines.push(`Also returned: ${others.join(", ")}.`);
		lines.push(
			`Credits charged: ${result.creditsCharged}. Unifers log: ${result.logId}.`,
		);

		await writeTimelineNote(contactId, NOTE_SUBJECT, lines.join("\n"), {
			kind: CONFIG.reveal.noteKind,
			outcome: "revealed",
			fields: result.fields,
			creditsCharged: result.creditsCharged,
			logId: result.logId,
		});

		return {
			revealed: Boolean(written.email || written.phone),
			written,
			fields: result.fields,
			creditsCharged: result.creditsCharged,
			note: "Saved values came from Unifers. Do not record them again as facts.",
		};
	},
});
