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
import {
	activityAssignmentRuleOutput,
	activitySettingsOverviewOutput,
	activityTypeItemOutput,
	archiveInactiveRecordsInput,
	backupItemOutput,
	clearDeletedDataInput,
	completionBehaviorOutput,
	createActivityAssignmentRuleInput,
	createActivityTypeInput,
	createBackupInput,
	createLeadAssignmentRuleInput,
	createLeadFieldInput,
	createLeadSourceInput,
	createLeadStatusInput,
	createRoleInput,
	createTeamInput,
	dataManagementOverviewOutput,
	dataRetentionSettingsOutput,
	defaultActivitySettingsOutput,
	defaultLeadOwnerOutput,
	deleteAccountInput,
	deleteActivityAssignmentRuleInput,
	deleteActivityTypeInput,
	deleteBackupInput,
	deleteLeadAssignmentRuleInput,
	deleteLeadFieldInput,
	deleteLeadSourceInput,
	deleteLeadStatusInput,
	exportDataInput,
	importDataInput,
	integrationItemOutput,
	integrationsOverviewOutput,
	invitationSettingsOutput,
	inviteUserInput,
	leadAssignmentRuleOutput,
	leadFieldOutput,
	leadSettingsOutput,
	leadSourceOutput,
	leadStatusOutput,
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
	updateDataRetentionInput,
	updateDefaultActivitySettingsInput,
	updateDefaultLeadOwnerInput,
	updateInvitationSettingsInput,
	updateLeadAssignmentRuleInput,
	updateLeadFieldInput,
	updateLeadSourceInput,
	updateLeadStatusInput,
	updateMemberStatusInput,
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
	async teams(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.teams(ctx.user.id);
	}

	@Query({
		output: z.array(roleItemOutput),
		meta: restMeta("GET", "/workspace/roles", ["Workspace"]),
	})
	async roles(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.roles(ctx.user.id);
	}

	@Query({
		output: invitationSettingsOutput,
		meta: restMeta("GET", "/workspace/invitation-settings", ["Workspace"]),
	})
	async invitationSettings(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.invitationSettings(ctx.user.id);
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
		input: updateMemberStatusInput,
		output: workspaceMemberOutput,
		meta: restMeta("PATCH", "/workspace/members/{memberId}/status", [
			"Workspace",
		]),
	})
	async updateMemberStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateMemberStatusInput>,
	) {
		return this.workspace.updateMemberStatus(ctx.user.id, input);
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

	@Mutation({
		input: createRoleInput,
		output: roleItemOutput,
		meta: restMeta("POST", "/workspace/roles", ["Workspace"]),
	})
	async createRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createRoleInput>,
	) {
		return this.workspace.createRole(ctx.user.id, input);
	}

	@Mutation({
		input: updateInvitationSettingsInput,
		output: invitationSettingsOutput,
		meta: restMeta("PATCH", "/workspace/invitation-settings", ["Workspace"]),
	})
	async updateInvitationSettings(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateInvitationSettingsInput>,
	) {
		return this.workspace.updateInvitationSettings(ctx.user.id, input);
	}

	@Mutation({
		input: inviteUserInput,
		output: z.object({ success: z.boolean(), email: z.string() }),
		meta: restMeta("POST", "/workspace/invite", ["Workspace"]),
	})
	async inviteUser(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inviteUserInput>,
	) {
		return this.workspace.inviteUser(ctx.user.id, input);
	}

	@Query({
		output: leadSettingsOutput,
		meta: restMeta("GET", "/workspace/lead-settings", ["Workspace"]),
	})
	async leadSettings(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.leadSettings(ctx.user.id);
	}

	@Mutation({
		input: createLeadSourceInput,
		output: leadSourceOutput,
		meta: restMeta("POST", "/workspace/lead-settings/sources", ["Workspace"]),
	})
	async createLeadSource(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createLeadSourceInput>,
	) {
		return this.workspace.createLeadSource(ctx.user.id, input);
	}

	@Mutation({
		input: updateLeadSourceInput,
		output: leadSourceOutput,
		meta: restMeta("PATCH", "/workspace/lead-settings/sources", ["Workspace"]),
	})
	async updateLeadSource(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateLeadSourceInput>,
	) {
		return this.workspace.updateLeadSource(ctx.user.id, input);
	}

	@Mutation({
		input: deleteLeadSourceInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/lead-settings/sources", ["Workspace"]),
	})
	async deleteLeadSource(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteLeadSourceInput>,
	) {
		return this.workspace.deleteLeadSource(ctx.user.id, input);
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
		input: createLeadStatusInput,
		output: leadStatusOutput,
		meta: restMeta("POST", "/workspace/lead-settings/statuses", ["Workspace"]),
	})
	async createLeadStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createLeadStatusInput>,
	) {
		return this.workspace.createLeadStatus(ctx.user.id, input);
	}

	@Mutation({
		input: updateLeadStatusInput,
		output: leadStatusOutput,
		meta: restMeta("PATCH", "/workspace/lead-settings/statuses", ["Workspace"]),
	})
	async updateLeadStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateLeadStatusInput>,
	) {
		return this.workspace.updateLeadStatus(ctx.user.id, input);
	}

	@Mutation({
		input: deleteLeadStatusInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/lead-settings/statuses", ["Workspace"]),
	})
	async deleteLeadStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteLeadStatusInput>,
	) {
		return this.workspace.deleteLeadStatus(ctx.user.id, input);
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
		meta: restMeta("PATCH", "/workspace/lead-settings/default-owner", ["Workspace"]),
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
		meta: restMeta("PATCH", "/workspace/activity-settings/defaults", ["Workspace"]),
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
		meta: restMeta("PATCH", "/workspace/activity-settings/reminders", ["Workspace"]),
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
		meta: restMeta("PATCH", "/workspace/activity-settings/completion-behavior", ["Workspace"]),
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
		meta: restMeta("PATCH", "/workspace/activity-settings/types", ["Workspace"]),
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
		meta: restMeta("DELETE", "/workspace/activity-settings/types", ["Workspace"]),
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
		meta: restMeta("POST", "/workspace/activity-settings/assignment-rules", ["Workspace"]),
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
		meta: restMeta("PATCH", "/workspace/activity-settings/assignment-rules", ["Workspace"]),
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
		meta: restMeta("DELETE", "/workspace/activity-settings/assignment-rules", ["Workspace"]),
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
		return this.workspace.dataManagement(ctx.user.id);
	}

	@Mutation({
		input: createBackupInput,
		output: backupItemOutput,
		meta: restMeta("POST", "/workspace/data-management/backups", ["Workspace"]),
	})
	async createBackup(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createBackupInput>,
	) {
		return this.workspace.createBackup(ctx.user.id, input);
	}

	@Mutation({
		input: deleteBackupInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("DELETE", "/workspace/data-management/backups", ["Workspace"]),
	})
	async deleteBackup(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteBackupInput>,
	) {
		return this.workspace.deleteBackup(ctx.user.id, input);
	}

	@Mutation({
		input: updateDataRetentionInput,
		output: dataRetentionSettingsOutput,
		meta: restMeta("PATCH", "/workspace/data-management/retention", ["Workspace"]),
	})
	async updateDataRetention(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateDataRetentionInput>,
	) {
		return this.workspace.updateDataRetention(ctx.user.id, input);
	}

	@Mutation({
		input: clearDeletedDataInput,
		output: z.object({ clearedCount: z.number() }),
		meta: restMeta("POST", "/workspace/data-management/clear-deleted", ["Workspace"]),
	})
	async clearDeletedData(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof clearDeletedDataInput>,
	) {
		return this.workspace.clearDeletedData(ctx.user.id, input);
	}

	@Mutation({
		input: archiveInactiveRecordsInput,
		output: z.object({ archivedCount: z.number() }),
		meta: restMeta("POST", "/workspace/data-management/archive-inactive", ["Workspace"]),
	})
	async archiveInactiveRecords(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof archiveInactiveRecordsInput>,
	) {
		return this.workspace.archiveInactiveRecords(ctx.user.id, input);
	}

	@Mutation({
		input: exportDataInput,
		output: z.object({ downloadUrl: z.string(), rowCount: z.number() }),
		meta: restMeta("POST", "/workspace/data-management/export", ["Workspace"]),
	})
	async exportData(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof exportDataInput>,
	) {
		return this.workspace.exportData(ctx.user.id, input);
	}

	@Mutation({
		input: importDataInput,
		output: z.object({ success: z.boolean(), importedCount: z.number() }),
		meta: restMeta("POST", "/workspace/data-management/import", ["Workspace"]),
	})
	async importData(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof importDataInput>,
	) {
		return this.workspace.importData(ctx.user.id, input);
	}

	@Mutation({
		input: deleteAccountInput,
		output: z.object({ success: z.boolean() }),
		meta: restMeta("POST", "/workspace/data-management/delete-account", ["Workspace"]),
	})
	async deleteAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof deleteAccountInput>,
	) {
		return this.workspace.deleteAccount(ctx.user.id, input);
	}
}
