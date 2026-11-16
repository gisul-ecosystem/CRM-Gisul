import {
	type EmailDraft,
	type EmailDraftRequest,
	emailDraftAnswer,
} from "@crm/validation/email-draft";
import { Injectable, Logger } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { AGENT_DISPATCH } from "./agent-dispatch.config";
import { bridge } from "./bridge";

@Injectable()
export class EmailDraftService {
	private readonly logger = new Logger(EmailDraftService.name);

	async draft(request: EmailDraftRequest): Promise<EmailDraft> {
		const agent = bridge();
		if (!agent) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message:
					"This install has no AGENT_BRIDGE_SECRET, so the agent cannot write the email.",
			});
		}

		let raw: unknown;
		try {
			const response = await fetch(agent.url("/internal/crm/draft-email"), {
				method: "POST",
				headers: {
					authorization: `Bearer ${agent.secret}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(request),
				signal: AbortSignal.timeout(AGENT_DISPATCH.emailDraft.timeoutMs),
			});
			raw = await response.json();
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			this.logger.warn({ message: "The agent did not answer a draft", reason });
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: "The agent did not answer. Try again in a minute.",
			});
		}

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
