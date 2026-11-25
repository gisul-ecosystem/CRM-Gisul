import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
	type ReplyDraftAnswer,
	type ReplyDraftRequest,
	replyDraft,
} from "@crm/validation/reply-draft";
import { withoutLinks } from "./campaign-draft";
import { REPLY_DRAFT } from "./campaign-draft-config";
import { EMAIL_DRAFT } from "./email-draft-config";
import { GISUL } from "./email-knowledge";

const SYSTEM = [
	"You answer a reply to a cold email. Plain text only, no markdown.",
	`Under ${REPLY_DRAFT.maxWords} words. Answer what they asked or said, directly and warmly. One clear next step.`,
	"Greet them by first name when it is known. Use only the facts given. No invented numbers, prices, customers or meeting times.",
	"Do not write any sign-off, closing or signature. One is added after your text.",
	"No links or web addresses.",
].join("\n");

function ask(request: ReplyDraftRequest): string {
	return [
		GISUL,
		"## Their reply",
		request.leadName ? `From: ${request.leadName}` : "",
		request.subject ? `Subject: ${request.subject}` : "",
		request.leadText.slice(0, REPLY_DRAFT.leadMaxChars),
		"## Goal",
		request.purpose || "Keep the conversation going toward a short call.",
		request.senderName ? `You write as ${request.senderName}.` : "",
	]
		.filter(Boolean)
		.join("\n");
}

export async function draftReply(
	request: ReplyDraftRequest,
): Promise<ReplyDraftAnswer> {
	const key = process.env[EMAIL_DRAFT.env.apiKey]?.trim();
	if (!key) {
		return {
			outcome: "not_configured",
			reason: `This install has no ${EMAIL_DRAFT.env.apiKey}, so Claude cannot write the reply.`,
		};
	}

	try {
		const client = new Anthropic({
			apiKey: key,
			timeout: REPLY_DRAFT.timeoutMs,
		});
		const response = await client.beta.messages.parse({
			model: process.env[EMAIL_DRAFT.env.model]?.trim() || REPLY_DRAFT.model,
			max_tokens: REPLY_DRAFT.maxTokens,
			thinking: { type: "disabled" },
			system: SYSTEM,
			messages: [{ role: "user", content: ask(request) }],
			output_config: {
				effort: REPLY_DRAFT.effort,
				format: betaZodOutputFormat(replyDraft),
			},
		});

		if (response.stop_reason === "refusal") {
			return {
				outcome: "failed",
				reason: "Claude declined to write this reply.",
			};
		}
		if (!response.parsed_output) {
			return {
				outcome: "failed",
				reason: `Claude's answer could not be read (stop reason: ${response.stop_reason ?? "none"}).`,
			};
		}
		return {
			outcome: "drafted",
			draft: { body: withoutLinks(response.parsed_output.body) },
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
