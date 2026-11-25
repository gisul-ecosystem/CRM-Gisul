import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { CompaniesModule } from "../companies/companies.module";
import { FieldsModule } from "../fields/fields.module";
import { TrpcModule } from "../trpc/trpc.module";
import { ContactEmailService } from "./contact-email.service";
import { ContactsRouter } from "./contacts.router";
import { ContactsService } from "./contacts.service";

@Module({
	imports: [FieldsModule, TrpcModule, AgentModule, CompaniesModule],
	providers: [ContactsService, ContactEmailService, ContactsRouter],
	exports: [ContactsService],
})
export class ContactsModule {}
