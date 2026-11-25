import {
	type CampaignDraft,
	type CampaignDraftRequest,
	campaignDraftAnswer,
} from "@crm/validation/campaign-draft";
import {
	type EmailDraft,
	type EmailDraftRequest,
	emailDraftAnswer,
} from "@crm/validation/email-draft";
import {
	type ReplyDraft,
	type ReplyDraftRequest,
	replyDraftAnswer,
} from "@crm/validation/reply-draft";
import { Injectable, Logger } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { AGENT_DISPATCH } from "./agent-dispatch.config";
import { bridge } from "./bridge";

@Injectable()
export class EmailDraftService {
	private readonly logger = new Logger(EmailDraftService.name);

	async draftCampaign(request: CampaignDraftRequest): Promise<CampaignDraft> {
		const raw = await this.ask("/internal/crm/draft-campaign", request);
		const answer = campaignDraftAnswer.safeParse(raw);
		if (!answer.success) {
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: `The agent sent unreadable emails: ${answer.error.message}`,
			});
		}
		if (answer.data.outcome === "drafted") return answer.data.draft;
		throw new TRPCError({
			code:
				answer.data.outcome === "not_configured"
					? "PRECONDITION_FAILED"
					: "BAD_GATEWAY",
			message: answer.data.reason,
		});
	}

	async draftReply(request: ReplyDraftRequest): Promise<ReplyDraft> {
		const raw = await this.ask("/internal/crm/draft-reply", request);
		const answer = replyDraftAnswer.safeParse(raw);
		if (!answer.success) {
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: `The agent sent an unreadable reply: ${answer.error.message}`,
			});
		}
		if (answer.data.outcome === "drafted") return answer.data.draft;
		throw new TRPCError({
			code:
				answer.data.outcome === "not_configured"
					? "PRECONDITION_FAILED"
					: "BAD_GATEWAY",
			message: answer.data.reason,
		});
	}

	private async ask(path: string, request: unknown): Promise<unknown> {
		const agent = bridge();
		if (!agent) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message:
					"This install has no AGENT_BRIDGE_SECRET, so the agent cannot write the email.",
			});
		}
		try {
			const response = await fetch(agent.url(path), {
				method: "POST",
				headers: {
					authorization: `Bearer ${agent.secret}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(request),
				signal: AbortSignal.timeout(AGENT_DISPATCH.emailDraft.timeoutMs),
			});
			return await response.json();
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			this.logger.warn({ message: "The agent did not answer a draft", reason });
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: "The agent did not answer. Try again in a minute.",
			});
		}
	}

	async draft(request: EmailDraftRequest): Promise<EmailDraft> {
		const raw = await this.ask("/internal/crm/draft-email", request);
		const answer = emailDraftAnswer.safeParse(raw);
		if (!answer.success) {
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: `The agent sent an unreadable draft: ${answer.error.message}`,
			});
		}

		const result = answer.data;
		if (result.outcome === "drafted") return result.draft;

		throw new TRPCError({
			code:
				result.outcome === "not_found"
					? "NOT_FOUND"
					: result.outcome === "not_configured"
						? "PRECONDITION_FAILED"
						: "BAD_GATEWAY",
			message: result.reason,
		});
	}
}
