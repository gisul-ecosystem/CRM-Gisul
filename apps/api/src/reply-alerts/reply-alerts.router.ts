import {
	type ReplyAlertSettingsInput,
	replyAlertSettings,
	replyAlertSettingsInput,
} from "@crm/validation/reply-alerts";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { ReplyAlertsService } from "./reply-alerts.service";

@Router({ alias: "replyAlerts" })
@UseMiddlewares(AuthMiddleware)
export class ReplyAlertsRouter {
	constructor(
		@Inject(ReplyAlertsService) private readonly alerts: ReplyAlertsService,
	) {}

	@Query({
		output: replyAlertSettings,
		meta: restMeta("GET", "/reply-alerts", ["Settings"]),
	})
	async settings(@Ctx() ctx: AuthedTrpcContext) {
		return this.alerts.settings(ctx.user.id);
	}

	@Mutation({
		input: replyAlertSettingsInput,
		output: replyAlertSettings,
		meta: restMeta("PATCH", "/reply-alerts", ["Settings"]),
	})
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: ReplyAlertSettingsInput,
	) {
		return this.alerts.update(ctx.user.id, input);
	}
}
