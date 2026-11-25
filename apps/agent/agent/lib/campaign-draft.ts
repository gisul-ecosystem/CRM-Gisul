import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db } from "@crm/db";
import {
	type CampaignDraft,
	type CampaignDraftAnswer,
	type CampaignDraftRequest,
	campaignDraft,
} from "@crm/validation/campaign-draft";
import { CAMPAIGN_DRAFT } from "./campaign-draft-config";
import { EMAIL_DRAFT } from "./email-draft-config";
import { CATEGORY_BRIEF, GISUL } from "./email-knowledge";

const SYSTEM = [
	"You write a cold email sequence template sent to many people. Plain text only, no markdown.",
	"Personalise only with the placeholders you are given, copied exactly, including any '| fallback'. Never invent other placeholders or square-bracket gaps.",
	`Email 1: under ${CAMPAIGN_DRAFT.body.firstMaxWords} words. Greet with the first-name placeholder, make one clear point tied to the reader's role or company, ask one easy question.`,
	`Each follow-up: under ${CAMPAIGN_DRAFT.body.followUpMaxWords} words, same thread, refer back in one line, add one new reason or a simpler ask. Do not repeat earlier emails.`,
	"Use only the facts given. No invented numbers, customers or meetings.",
	"Do not write any sign-off, closing or signature. One is added after your text.",
	"Subjects are short, specific and low-key.",
].join("\n");

const BASE = /^\{\{\s*([^|}\s]+)/;
const LINK = /\s*\(?\b(?:https?:\/\/|www\.)[^\s)]+\)?/g;

function baseName(token: string): string {
	return BASE.exec(token)?.[1]?.toLowerCase() ?? "";
}

export function keepPlaceholders(text: string, allowed: string[]): string {
	const byBase = new Map(allowed.map((token) => [baseName(token), token]));
	return text
		.replace(/\{\{[^{}]*\}\}/g, (token) => byBase.get(baseName(token)) ?? "")
		.replace(/[ \t]{2,}/g, " ")
		.trim();
}

function clip(text: string | null | undefined, max: number): string | null {
	const value = text?.trim();
	if (!value) return null;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function withoutLinks(text: string): string {
	return text.replace(LINK, "").trim();
}

async function productLines(
	productId: string | null,
	includeLink: boolean,
): Promise<string[]> {
	if (!productId) return [];
	const product = await db.product.findFirst({
		where: { id: productId, archivedAt: null },
		select: { name: true, shortDescription: true, website: true },
	});
	if (!product) return [];
	return [
		"## Product to pitch",
		`${product.name}: ${clip(product.shortDescription, CAMPAIGN_DRAFT.product.maxDescriptionChars)}`,
		includeLink && product.website ? `Link: ${product.website}` : "",
	];
}

function audienceLines(request: CampaignDraftRequest): string[] {
	const { name, titles, companies } = request.audience;
	return [
		"## Audience",
		name ? `List: ${name}` : "",
		titles.length ? `Sample titles: ${titles.join("; ")}` : "",
		companies.length ? `Sample companies: ${companies.join("; ")}` : "",
		`Placeholders: ${request.placeholders.join(" ")}`,
	];
}

function ask(request: CampaignDraftRequest, product: string[]): string {
	return [
		...(product.length ? product : [GISUL]),
		request.category ? CATEGORY_BRIEF[request.category] : "",
		...audienceLines(request),
		"## Goal",
		request.purpose || "Introduce the product and start a conversation.",
		request.includeLink
			? "Put one website link once in email 1, near the ask: the product's link, otherwise the matching site above. No other links."
			: "Write no links, URLs or web addresses in any email.",
		`Write exactly ${request.steps} email${request.steps === 1 ? "" : "s"}: email 1${request.steps > 1 ? ` and ${request.steps - 1} follow-up${request.steps > 2 ? "s" : ""}` : ""}.`,
	]
		.filter(Boolean)
		.join("\n");
}

function clean(
	draft: CampaignDraft,
	request: CampaignDraftRequest,
): CampaignDraft {
	return {
		steps: draft.steps.slice(0, request.steps).map((step) => ({
			subject: keepPlaceholders(step.subject, request.placeholders),
			body: keepPlaceholders(
				request.includeLink ? step.body : withoutLinks(step.body),
				request.placeholders,
			),
		})),
	};
}

export async function draftCampaign(
	request: CampaignDraftRequest,
): Promise<CampaignDraftAnswer> {
	const key = process.env[EMAIL_DRAFT.env.apiKey]?.trim();
	if (!key) {
		return {
			outcome: "not_configured",
			reason: `This install has no ${EMAIL_DRAFT.env.apiKey}, so Claude cannot write the emails.`,
		};
	}

	try {
		const product = await productLines(request.productId, request.includeLink);
		const client = new Anthropic({
			apiKey: key,
			timeout: CAMPAIGN_DRAFT.timeoutMs,
		});
		const response = await client.beta.messages.parse({
			model: process.env[EMAIL_DRAFT.env.model]?.trim() || CAMPAIGN_DRAFT.model,
			max_tokens: CAMPAIGN_DRAFT.maxTokensPerStep * request.steps,
			thinking: { type: "disabled" },
			system: SYSTEM,
			messages: [{ role: "user", content: ask(request, product) }],
			output_config: {
				effort: CAMPAIGN_DRAFT.effort,
				format: betaZodOutputFormat(campaignDraft),
			},
		});

		if (response.stop_reason === "refusal") {
			return {
				outcome: "failed",
				reason: "Claude declined to write these emails.",
			};
		}
		if (!response.parsed_output) {
			return {
				outcome: "failed",
				reason: `Claude's answer could not be read (stop reason: ${response.stop_reason ?? "none"}).`,
			};
		}
		if (response.parsed_output.steps.length < request.steps) {
			return {
				outcome: "failed",
				reason: `Claude wrote ${response.parsed_output.steps.length} of ${request.steps} emails. Try again.`,
			};
		}
		return {
			outcome: "drafted",
			draft: clean(response.parsed_output, request),
		};
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
