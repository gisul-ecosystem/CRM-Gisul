import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { ReplyAlertsRouter } from "./reply-alerts.router";
import { ReplyAlertsService } from "./reply-alerts.service";
import { TenantMailClient } from "./tenant-mail.client";

@Module({
	imports: [TrpcModule],
	providers: [TenantMailClient, ReplyAlertsService, ReplyAlertsRouter],
})
export class ReplyAlertsModule {}
