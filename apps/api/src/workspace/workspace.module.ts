import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { CompaniesModule } from "../companies/companies.module";
import { ContactsModule } from "../contacts/contacts.module";
import { DealsModule } from "../deals/deals.module";
import { TrpcModule } from "../trpc/trpc.module";
import { DataManagementService } from "./data-management.service";
import { WorkspaceRouter } from "./workspace.router";
import { WorkspaceService } from "./workspace.service";

@Module({
	imports: [
		AgentModule,
		TrpcModule,
		ContactsModule,
		CompaniesModule,
		DealsModule,
	],
	providers: [WorkspaceService, DataManagementService, WorkspaceRouter],
	exports: [WorkspaceService],
})
export class WorkspaceModule {}
