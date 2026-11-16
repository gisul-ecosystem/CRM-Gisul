import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db } from "@crm/db";
import {
	type EmailDraftAnswer,
	type EmailDraftRequest,
	emailDraft,
} from "@crm/validation/email-draft";
import { EMAIL_DRAFT } from "./email-draft-config";

const SYSTEM = [
	"You write one short, personal sales email from a CRM user to one person.",
	"Write plain text only. No markdown, no links you were not given, no placeholders in square brackets.",
	`Keep the body under ${EMAIL_DRAFT.body.maxWords} words. Open with a line that shows you know who they are, then make one clear point, then ask one easy question.`,
	"Use only the facts you are given. Do not invent numbers, customers, meetings or past contact.",
	"Sign off with the sender's name when it is given, otherwise end without a signature.",
	"The subject is short, specific and lower-key than a headline.",
].join("\n");

function clip(text: string | null | undefined, max: number): string | null {
	const value = text?.trim();
	if (!value) return null;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

function apiKey(): string | null {
	return process.env[EMAIL_DRAFT.env.apiKey]?.trim() || null;
}

function model(): string {
	return process.env[EMAIL_DRAFT.env.model]?.trim() || EMAIL_DRAFT.model;
}

async function contactContext(contactId: string): Promise<string | null> {
	const contact = await db.contact.findFirst({
		where: { id: contactId, archivedAt: null },
		select: {
			firstName: true,
			lastName: true,
			title: true,
			seniority: true,
			function: true,
			brief: { select: { narrative: true } },
			company: {
				select: {
					name: true,
					domain: true,
					industry: true,
					description: true,
				},
			},
			product: {
				select: {
					name: true,
					shortDescription: true,
					detailedDescription: true,
				},
			},
		},
	});
	if (!contact) return null;

	const lines = [
		"## The person",
		`Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(" ")}`,
		contact.title ? `Title: ${contact.title}` : null,
		contact.seniority ? `Seniority: ${contact.seniority}` : null,
		contact.function ? `Function: ${contact.function}` : null,
		contact.brief
			? `Background: ${clip(contact.brief.narrative, EMAIL_DRAFT.brief.maxChars)}`
			: null,
	];

	if (contact.company) {
		lines.push(
			"",
			"## Their company",
			`Name: ${contact.company.name}`,
			contact.company.domain ? `Website: ${contact.company.domain}` : null,
			contact.company.industry ? `Industry: ${contact.company.industry}` : null,
			contact.company.description
				? `About: ${clip(contact.company.description, EMAIL_DRAFT.company.maxDescriptionChars)}`
				: null,
		);
	}

	if (contact.product) {
		lines.push(
			"",
			"## What we want to talk to them about",
			`Product: ${contact.product.name}`,
			`Summary: ${contact.product.shortDescription}`,
			contact.product.detailedDescription
				? `Detail: ${clip(contact.product.detailedDescription, EMAIL_DRAFT.product.maxDescriptionChars)}`
				: null,
		);
	}

	return lines.filter((line) => line !== null).join("\n");
}

export async function draftEmail(
	request: EmailDraftRequest,
): Promise<EmailDraftAnswer> {
	const key = apiKey();
	if (!key) {
		return {
			outcome: "not_configured",
			reason: `This install has no ${EMAIL_DRAFT.env.apiKey}, so Claude cannot write the email.`,
		};
	}

	const context = await contactContext(request.contactId);
	if (!context) {
		return { outcome: "not_found", reason: "That contact does not exist." };
	}

	const ask = [
		context,
		"",
		"## The sender",
		request.senderName ? `Name: ${request.senderName}` : "Name: not given",
		"",
		"## What this email is for",
		request.purpose ||
			"A first, friendly introduction that starts a conversation.",
	].join("\n");

	try {
		const client = new Anthropic({
			apiKey: key,
			timeout: EMAIL_DRAFT.timeoutMs,
		});
		const response = await client.beta.messages.parse({
			model: model(),
			max_tokens: EMAIL_DRAFT.maxTokens,
			betas: [EMAIL_DRAFT.fallbackBeta],
			fallbacks: "default",
			system: SYSTEM,
			messages: [{ role: "user", content: ask }],
			output_config: {
				effort: EMAIL_DRAFT.effort,
				format: betaZodOutputFormat(emailDraft),
			},
		});

		if (response.stop_reason === "refusal") {
			return {
				outcome: "failed",
				reason: "Claude declined to write this email.",
			};
		}
		if (!response.parsed_output) {
			return {
				outcome: "failed",
				reason: `Claude's answer could not be read (stop reason: ${response.stop_reason ?? "none"}).`,
			};
		}

		return { outcome: "drafted", draft: response.parsed_output };
	} catch (error) {
		if (error instanceof Anthropic.AuthenticationError) {
			return {
				outcome: "not_configured",
				reason: `Anthropic did not accept ${EMAIL_DRAFT.env.apiKey}.`,
			};
		}
		if (error instanceof Anthropic.RateLimitError) {
			return {
				outcome: "failed",
				reason: "Claude is rate limited. Try again in a minute.",
			};
		}
		if (error instanceof Anthropic.APIError) {
			return {
				outcome: "failed",
				reason: `Claude answered ${error.status}: ${error.message}`,
			};
		}
		return {
			outcome: "failed",
			reason: error instanceof Error ? error.message : String(error),
		};
	}
}
