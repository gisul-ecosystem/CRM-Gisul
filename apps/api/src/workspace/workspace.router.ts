import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { DataManagementService } from "./data-management.service";
import {
	activityAssignmentRuleOutput,
	activitySettingsOverviewOutput,
	activityTypeItemOutput,
	archiveInactiveRecordsInput,
	archiveInactiveRecordsOutput,
	backupDownloadOutput,
	backupIdInput,
	backupItemOutput,
	clearDeletedDataInput,
	clearDeletedDataOutput,
	completionBehaviorOutput,
	createActivityAssignmentRuleInput,
	createActivityTypeInput,
	createBackupInput,
	createLeadAssignmentRuleInput,
	createLeadFieldInput,
	createTeamInput,
	dataManagementOverviewOutput,
	defaultActivitySettingsOutput,
	defaultLeadOwnerOutput,
	deleteActivityAssignmentRuleInput,
	deleteActivityTypeInput,
	deleteLeadAssignmentRuleInput,
	deleteLeadFieldInput,
	duplicateEntityInput,
	duplicateGroupsOutput,
	entityInput,
	exportDataOutput,
	importDataInput,
	importDataOutput,
	importTemplateOutput,
	integrationItemOutput,
	integrationsOverviewOutput,
	invitationSettingsOutput,
	leadAssignmentRuleOutput,
	leadFieldOutput,
	leadSettingsOutput,
	memberListInput,
	memberListOutput,
	reminderRulesOutput,
	roleItemOutput,
	setMemberRoleInput,
	teamItemOutput,
	toggleIntegrationInput,
	updateActivityAssignmentRuleInput,
	updateActivityTypeInput,
	updateCompletionBehaviorInput,
	updateDefaultActivitySettingsInput,
	updateDefaultLeadOwnerInput,
	updateLeadAssignmentRuleInput,
	updateLeadFieldInput,
	updateMemberTeamInput,
	updateReminderRulesInput,
	updateWorkspaceInput,
	workspaceMemberOutput,
	workspaceOutput,
} from "./workspace.contracts";
import { WorkspaceService } from "./workspace.service";

@Router({ alias: "workspace" })
@UseMiddlewares(AuthMiddleware)
export class WorkspaceRouter {
	constructor(
		@Inject(WorkspaceService) private readonly workspace: WorkspaceService,
		@Inject(DataManagementService)
		private readonly data: DataManagementService,
	) {}

	@Query({
		output: workspaceOutput,
		meta: restMeta("GET", "/workspace", ["Workspace"]),
	})
	async get(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.get(ctx.user.id);
	}

	@Query({
		input: memberListInput,
		output: memberListOutput,
		meta: restMeta("POST", "/workspace/members/search", ["Workspace"]),
	})
	async members(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof memberListInput>,
	) {
		return this.workspace.members(ctx.user.id, input);
	}

	@Query({
		output: z.array(teamItemOutput),
		meta: restMeta("GET", "/workspace/teams", ["Workspace"]),
	})
	async teams() {
		return this.workspace.teams();
	}

	@Query({
		output: z.array(roleItemOutput),
		meta: restMeta("GET", "/workspace/roles", ["Workspace"]),
	})
	async roles() {
		return this.workspace.roles();
	}

	@Query({
		output: invitationSettingsOutput,
		meta: restMeta("GET", "/workspace/invitation-settings", ["Workspace"]),
	})
	invitationSettings() {
		return this.workspace.invitationSettings();
	}

	@Mutation({
		input: updateWorkspaceInput,
		output: workspaceOutput,
		meta: restMeta("PATCH", "/workspace", ["Workspace"]),
	})
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateWorkspaceInput>,
	) {
		return this.workspace.update(ctx.user.id, input);
	}

	@Mutation({
		input: setMemberRoleInput,
		output: workspaceMemberOutput,
		meta: restMeta("PATCH", "/workspace/members/{memberId}/role", [
			"Workspace",
		]),
	})
	async setMemberRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberRoleInput>,
	) {
		return this.workspace.setMemberRole(ctx.user.id, input);
	}

	@Mutation({
		input: updateMemberTeamInput,
		output: workspaceMemberOutput,
		meta: restMeta("PATCH", "/workspace/members/{memberId}/team", [
			"Workspace",
		]),
	})
	async updateMemberTeam(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateMemberTeamInput>,
	) {
		return this.workspace.updateMemberTeam(ctx.user.id, input);
	}

	@Mutation({
		input: createTeamInput,
		output: teamItemOutput,
		meta: restMeta("POST", "/workspace/teams", ["Workspace"]),
	})
	async createTeam(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createTeamInput>,
	) {
		return this.workspace.createTeam(ctx.user.id, input);
	}

	@Query({
		output: leadSettingsOutput,
		meta: restMeta("GET", "/workspace/lead-settings", ["Workspace"]),
	})
	async leadSettings(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.leadSettings(ctx.user.id);
	}

	@Mutation({
		input: createLeadFieldInput,
		output: leadFieldOutput,
		meta: restMeta("POST", "/workspace/lead-settings/fields", ["Workspace"]),
	})
	async createLeadField(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createLeadFieldInput>,
	) {
		return this.workspace.createLeadField(ctx.user.id, input);
	}

	@Mutation({
		input: updateLeadFieldInput,
		output: leadFieldOutput,
		meta: restMeta("PATCH", "/workspace/lead-settings/fields", ["Workspace"]),
	})
	async updateLeadField(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateLeadFieldInput>,
	) {
		return this.workspace.updateLeadField(ctx.user.id, input);
	}

	@Mutation({
		input: deleteLeadFieldInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/lead-settings/fields", ["Workspace"]),
	})
	async deleteLeadField(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteLeadFieldInput>,
	) {
		return this.workspace.deleteLeadField(ctx.user.id, input);
	}

	@Mutation({
		input: createLeadAssignmentRuleInput,
		output: leadAssignmentRuleOutput,
		meta: restMeta("POST", "/workspace/lead-settings/rules", ["Workspace"]),
	})
	async createLeadAssignmentRule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createLeadAssignmentRuleInput>,
	) {
		return this.workspace.createLeadAssignmentRule(ctx.user.id, input);
	}

	@Mutation({
		input: updateLeadAssignmentRuleInput,
		output: leadAssignmentRuleOutput,
		meta: restMeta("PATCH", "/workspace/lead-settings/rules", ["Workspace"]),
	})
	async updateLeadAssignmentRule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateLeadAssignmentRuleInput>,
	) {
		return this.workspace.updateLeadAssignmentRule(ctx.user.id, input);
	}

	@Mutation({
		input: deleteLeadAssignmentRuleInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/lead-settings/rules", ["Workspace"]),
	})
	async deleteLeadAssignmentRule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteLeadAssignmentRuleInput>,
	) {
		return this.workspace.deleteLeadAssignmentRule(ctx.user.id, input);
	}

	@Mutation({
		input: updateDefaultLeadOwnerInput,
		output: defaultLeadOwnerOutput,
		meta: restMeta("PATCH", "/workspace/lead-settings/default-owner", [
			"Workspace",
		]),
	})
	async updateDefaultLeadOwner(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateDefaultLeadOwnerInput>,
	) {
		return this.workspace.updateDefaultLeadOwner(ctx.user.id, input);
	}

	@Query({
		output: integrationsOverviewOutput,
		meta: restMeta("GET", "/workspace/integrations", ["Workspace"]),
	})
	async integrations(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.integrations(ctx.user.id);
	}

	@Mutation({
		input: toggleIntegrationInput,
		output: integrationItemOutput,
		meta: restMeta("PATCH", "/workspace/integrations/toggle", ["Workspace"]),
	})
	async toggleIntegration(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof toggleIntegrationInput>,
	) {
		return this.workspace.toggleIntegration(ctx.user.id, input);
	}

	@Query({
		output: activitySettingsOverviewOutput,
		meta: restMeta("GET", "/workspace/activity-settings", ["Workspace"]),
	})
	async activitySettings(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.activitySettings(ctx.user.id);
	}

	@Mutation({
		input: updateDefaultActivitySettingsInput,
		output: defaultActivitySettingsOutput,
		meta: restMeta("PATCH", "/workspace/activity-settings/defaults", [
			"Workspace",
		]),
	})
	async updateDefaultActivitySettings(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateDefaultActivitySettingsInput>,
	) {
		return this.workspace.updateDefaultActivitySettings(ctx.user.id, input);
	}

	@Mutation({
		input: updateReminderRulesInput,
		output: reminderRulesOutput,
		meta: restMeta("PATCH", "/workspace/activity-settings/reminders", [
			"Workspace",
		]),
	})
	async updateReminderRules(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateReminderRulesInput>,
	) {
		return this.workspace.updateReminderRules(ctx.user.id, input);
	}

	@Mutation({
		input: updateCompletionBehaviorInput,
		output: completionBehaviorOutput,
		meta: restMeta(
			"PATCH",
			"/workspace/activity-settings/completion-behavior",
			["Workspace"],
		),
	})
	async updateCompletionBehavior(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateCompletionBehaviorInput>,
	) {
		return this.workspace.updateCompletionBehavior(ctx.user.id, input);
	}

	@Mutation({
		input: createActivityTypeInput,
		output: activityTypeItemOutput,
		meta: restMeta("POST", "/workspace/activity-settings/types", ["Workspace"]),
	})
	async createActivityType(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createActivityTypeInput>,
	) {
		return this.workspace.createActivityType(ctx.user.id, input);
	}

	@Mutation({
		input: updateActivityTypeInput,
		output: activityTypeItemOutput,
		meta: restMeta("PATCH", "/workspace/activity-settings/types", [
			"Workspace",
		]),
	})
	async updateActivityType(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateActivityTypeInput>,
	) {
		return this.workspace.updateActivityType(ctx.user.id, input);
	}

	@Mutation({
		input: deleteActivityTypeInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/activity-settings/types", [
			"Workspace",
		]),
	})
	async deleteActivityType(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteActivityTypeInput>,
	) {
		return this.workspace.deleteActivityType(ctx.user.id, input);
	}

	@Mutation({
		input: createActivityAssignmentRuleInput,
		output: activityAssignmentRuleOutput,
		meta: restMeta("POST", "/workspace/activity-settings/assignment-rules", [
			"Workspace",
		]),
	})
	async createActivityAssignmentRule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createActivityAssignmentRuleInput>,
	) {
		return this.workspace.createActivityAssignmentRule(ctx.user.id, input);
	}

	@Mutation({
		input: updateActivityAssignmentRuleInput,
		output: activityAssignmentRuleOutput,
		meta: restMeta("PATCH", "/workspace/activity-settings/assignment-rules", [
			"Workspace",
		]),
	})
	async updateActivityAssignmentRule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateActivityAssignmentRuleInput>,
	) {
		return this.workspace.updateActivityAssignmentRule(ctx.user.id, input);
	}

	@Mutation({
		input: deleteActivityAssignmentRuleInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/activity-settings/assignment-rules", [
			"Workspace",
		]),
	})
	async deleteActivityAssignmentRule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteActivityAssignmentRuleInput>,
	) {
		return this.workspace.deleteActivityAssignmentRule(ctx.user.id, input);
	}

	@Query({
		output: dataManagementOverviewOutput,
		meta: restMeta("GET", "/workspace/data-management", ["Workspace"]),
	})
	async dataManagement(@Ctx() ctx: AuthedTrpcContext) {
		return this.data.overview(ctx.user.id);
	}

	@Mutation({
		input: createBackupInput,
		output: backupItemOutput,
		meta: restMeta("POST", "/workspace/backups", ["Workspace"]),
	})
	async createBackup(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createBackupInput>,
	) {
		return this.data.createBackup(ctx.user.id, input);
	}

	@Mutation({
		input: backupIdInput,
		output: backupDownloadOutput,
		meta: restMeta("POST", "/workspace/backups/{id}/download", ["Workspace"]),
	})
	async downloadBackup(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof backupIdInput>,
	) {
		return this.data.downloadBackup(ctx.user.id, input);
	}

	@Mutation({
		input: backupIdInput,
		output: backupIdInput,
		meta: restMeta("DELETE", "/workspace/backups/{id}", ["Workspace"]),
	})
	async deleteBackup(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof backupIdInput>,
	) {
		return this.data.deleteBackup(ctx.user.id, input);
	}

	@Mutation({
		input: clearDeletedDataInput,
		output: clearDeletedDataOutput,
		meta: restMeta("POST", "/workspace/data/clear-archived", ["Workspace"]),
	})
	async clearDeletedData(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof clearDeletedDataInput>,
	) {
		return this.data.clearDeletedData(ctx.user.id, input);
	}

	@Mutation({
		input: archiveInactiveRecordsInput,
		output: archiveInactiveRecordsOutput,
		meta: restMeta("POST", "/workspace/data/archive-inactive", ["Workspace"]),
	})
	async archiveInactiveRecords(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof archiveInactiveRecordsInput>,
	) {
		return this.data.archiveInactiveRecords(ctx.user.id, input);
	}

	@Mutation({
		input: entityInput,
		output: exportDataOutput,
		meta: restMeta("POST", "/workspace/data/export", ["Workspace"]),
	})
	async exportData(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof entityInput>,
	) {
		return this.data.exportData(ctx.user.id, input);
	}

	@Mutation({
		input: importDataInput,
		output: importDataOutput,
		meta: restMeta("POST", "/workspace/data/import", ["Workspace"]),
	})
	async importData(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof importDataInput>,
	) {
		return this.data.importData(ctx.user.id, input);
	}

	@Query({
		input: entityInput,
		output: importTemplateOutput,
		meta: restMeta("POST", "/workspace/data/import-template", ["Workspace"]),
	})
	importTemplate(@Input() input: z.infer<typeof entityInput>) {
		return this.data.importTemplate(input);
	}

	@Query({
		input: duplicateEntityInput,
		output: duplicateGroupsOutput,
		meta: restMeta("POST", "/workspace/data/duplicates", ["Workspace"]),
	})
	async findDuplicates(@Input() input: z.infer<typeof duplicateEntityInput>) {
		return this.data.findDuplicates(input);
	}
}
