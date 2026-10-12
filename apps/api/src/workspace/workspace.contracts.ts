import { WORKSPACE_ROLES } from "@crm/auth";
import { LeadSource, LeadStatus } from "@crm/db/enums";
import { MAX_SLUG } from "@crm/db/workspace";
import { z } from "zod";
import { listInput } from "../trpc/list-input";
import { DATA_MANAGEMENT } from "./workspace-config";

export const MEMBER_ACTIVITY_STATUSES = ["active", "inactive"] as const;

export type MemberActivityStatus = (typeof MEMBER_ACTIVITY_STATUSES)[number];

export const memberListInput = listInput.extend({
	role: z.array(z.string()).default([]),
	team: z.array(z.string()).default([]),
	status: z.array(z.string()).default([]),
});

export type MemberListInput = z.infer<typeof memberListInput>;

export const workspacePreferencesOutput = z.object({
	showProductFilterInAllModules: z.boolean().default(true),
	enableEmailNotifications: z.boolean().default(true),
	autoAssignNewLeads: z.boolean().default(false),
	enableDesktopNotifications: z.boolean().default(true),
	allowDuplicateLeads: z.boolean().default(false),
	setFollowUpReminders: z.boolean().default(true),
});

export const updateWorkspaceInput = z.object({
	name: z.string().trim().min(1).max(120),
	website: z.string().trim().min(1).max(255),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(MAX_SLUG)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.optional(),
	industry: z.string().optional(),
	companySize: z.string().optional(),
	description: z.string().max(500).optional(),
	logoUrl: z.string().nullable().optional(),
	timezone: z.string().optional(),
	dateFormat: z.string().optional(),
	timeFormat: z.string().optional(),
	currency: z.string().optional(),
	preferences: workspacePreferencesOutput.partial().optional(),
});

export const setMemberRoleInput = z.object({
	memberId: z.string().min(1),
	role: z.enum(WORKSPACE_ROLES),
});

export const updateMemberTeamInput = z.object({
	memberId: z.string().min(1),
	teamId: z.string().min(1).nullable(),
});

export const createTeamInput = z.object({
	name: z.string().trim().min(1).max(50),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInput>;
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInput>;
export type UpdateMemberTeamInput = z.infer<typeof updateMemberTeamInput>;
export type CreateTeamInput = z.infer<typeof createTeamInput>;

export const workspaceOutput = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	website: z.string().nullable(),
	industry: z.string().default("Technology"),
	companySize: z.string().default("11-50 employees"),
	description: z
		.string()
		.default(
			"We build innovative products and solutions to help businesses grow. Our product ecosystem includes Aaptor, Racko and Kanonkode.",
		),
	logoUrl: z.string().nullable().default(null),
	timezone: z.string().default("(GMT+05:30) Asia/Kolkata"),
	dateFormat: z.string().default("25 Sep 2025"),
	timeFormat: z.string().default("12-hour (AM/PM)"),
	currency: z.string().default("INR"),
	preferences: workspacePreferencesOutput,
	onboarded: z.boolean(),
	viewerRole: z.enum(WORKSPACE_ROLES).nullable(),
	canRename: z.boolean(),
	canChangeRoles: z.boolean(),
});

export type Workspace = z.infer<typeof workspaceOutput>;

export const workspaceMemberOutput = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	role: z.enum(WORKSPACE_ROLES),
	teamId: z.string().nullable(),
	team: z.string().nullable(),
	status: z.enum(MEMBER_ACTIVITY_STATUSES),
	lastActive: z.string().nullable(),
	joinedAt: z.string(),
	isViewer: z.boolean(),
});

export type WorkspaceMember = z.infer<typeof workspaceMemberOutput>;

export const memberListOutput = z.object({
	rows: z.array(workspaceMemberOutput),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
});

export const teamItemOutput = z.object({
	id: z.string(),
	name: z.string(),
	memberCount: z.number(),
});

export type TeamItem = z.infer<typeof teamItemOutput>;

export const roleItemOutput = z.object({
	id: z.enum(WORKSPACE_ROLES),
	userCount: z.number(),
});

export type RoleItem = z.infer<typeof roleItemOutput>;

export const invitationSettingsOutput = z.object({
	signInUrl: z.string(),
	allowedDomains: z.array(z.string()),
	defaultRole: z.enum(WORKSPACE_ROLES),
});

export type InvitationSettings = z.infer<typeof invitationSettingsOutput>;

export const leadSourceOutput = z.object({
	id: z.enum(Object.values(LeadSource) as [LeadSource, ...LeadSource[]]),
	leadsCount: z.number(),
});
export type LeadSourceItem = z.infer<typeof leadSourceOutput>;

export const leadFieldOutput = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum([
		"text",
		"email",
		"phone",
		"dropdown",
		"textarea",
		"number",
		"date",
	]),
	required: z.boolean().default(false),
	showInForm: z.boolean().default(true),
	isCustom: z.boolean().default(false),
});
export type LeadFieldItem = z.infer<typeof leadFieldOutput>;

export const leadStatusOutput = z.object({
	id: z.enum(Object.values(LeadStatus) as [LeadStatus, ...LeadStatus[]]),
	leadsCount: z.number(),
});
export type LeadStatusItem = z.infer<typeof leadStatusOutput>;

export const leadAssignmentRuleOutput = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	icon: z.string().default("link"),
	enabled: z.boolean().default(true),
});
export type LeadAssignmentRuleItem = z.infer<typeof leadAssignmentRuleOutput>;

export const defaultLeadOwnerOutput = z.object({
	userId: z.string().nullable(),
	name: z.string().nullable().optional(),
	role: z.string().nullable().optional(),
	image: z.string().nullable().optional(),
});
export type DefaultLeadOwner = z.infer<typeof defaultLeadOwnerOutput>;

export const leadSettingsOutput = z.object({
	sources: z.array(leadSourceOutput),
	unsourcedCount: z.number(),
	fields: z.array(leadFieldOutput),
	statuses: z.array(leadStatusOutput),
	assignmentRules: z.array(leadAssignmentRuleOutput),
	defaultOwner: defaultLeadOwnerOutput,
});
export type LeadSettingsData = z.infer<typeof leadSettingsOutput>;

export const createLeadFieldInput = z.object({
	name: z.string().trim().min(1).max(50),
	type: z.enum([
		"text",
		"email",
		"phone",
		"dropdown",
		"textarea",
		"number",
		"date",
	]),
	required: z.boolean().default(false),
	showInForm: z.boolean().default(true),
});
export type CreateLeadFieldInput = z.infer<typeof createLeadFieldInput>;

export const updateLeadFieldInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(50).optional(),
	type: z
		.enum(["text", "email", "phone", "dropdown", "textarea", "number", "date"])
		.optional(),
	required: z.boolean().optional(),
	showInForm: z.boolean().optional(),
});
export type UpdateLeadFieldInput = z.infer<typeof updateLeadFieldInput>;

export const deleteLeadFieldInput = z.object({
	id: z.string().min(1),
});
export type DeleteLeadFieldInput = z.infer<typeof deleteLeadFieldInput>;

export const createLeadAssignmentRuleInput = z.object({
	title: z.string().trim().min(1).max(120),
	description: z.string().trim().max(255),
	icon: z.string().default("link"),
	enabled: z.boolean().default(true),
});
export type CreateLeadAssignmentRuleInput = z.infer<
	typeof createLeadAssignmentRuleInput
>;

export const updateLeadAssignmentRuleInput = z.object({
	id: z.string().min(1),
	enabled: z.boolean().optional(),
	title: z.string().trim().min(1).max(120).optional(),
	description: z.string().trim().max(255).optional(),
	icon: z.string().optional(),
});
export type UpdateLeadAssignmentRuleInput = z.infer<
	typeof updateLeadAssignmentRuleInput
>;

export const deleteLeadAssignmentRuleInput = z.object({
	id: z.string().min(1),
});
export type DeleteLeadAssignmentRuleInput = z.infer<
	typeof deleteLeadAssignmentRuleInput
>;

export const updateDefaultLeadOwnerInput = z.object({
	userId: z.string().nullable(),
});
export type UpdateDefaultLeadOwnerInput = z.infer<
	typeof updateDefaultLeadOwnerInput
>;

export const integrationItemOutput = z.object({
	id: z.string(),
	name: z.string(),
	category: z.enum([
		"communication",
		"collaboration",
		"marketing",
		"development",
	]),
	description: z.string(),
	status: z.enum(["connected", "not_connected", "enabled", "available"]),
	connected: z.boolean(),
	enabled: z.boolean(),
	accountName: z.string().nullable().optional(),
	settingsUrl: z.string().nullable().optional(),
});
export type IntegrationItem = z.infer<typeof integrationItemOutput>;

export const integrationsOverviewOutput = z.object({
	summary: z.object({
		total: z.number(),
		connected: z.number(),
		available: z.number(),
		notConnected: z.number(),
	}),
	integrations: z.array(integrationItemOutput),
});
export type IntegrationsOverview = z.infer<typeof integrationsOverviewOutput>;

export const toggleIntegrationInput = z.object({
	id: z.string().min(1),
	enabled: z.boolean(),
});
export type ToggleIntegrationInput = z.infer<typeof toggleIntegrationInput>;

export const activityTypeItemOutput = z.object({
	id: z.string(),
	name: z.string(),
	icon: z.string(),
	iconColor: z.string().default("#22c55e"),
	defaultReminder: z.string(),
	autoFollowUp: z.string(),
	status: z.boolean(),
});
export type ActivityTypeItem = z.infer<typeof activityTypeItemOutput>;

export const defaultActivitySettingsOutput = z.object({
	defaultActivityType: z.string(),
	defaultDuration: z.string(),
	defaultReminderTime: z.string(),
	defaultOwnerId: z.string().nullable(),
	defaultOwnerName: z.string().nullable(),
	addToCalendar: z.boolean(),
});
export type DefaultActivitySettings = z.infer<
	typeof defaultActivitySettingsOutput
>;

export const reminderRulesOutput = z.object({
	enableActivityReminders: z.boolean(),
	emailReminders: z.boolean(),
	overdueNotifications: z.boolean(),
	timingOptions: z.array(z.string()),
});
export type ReminderRules = z.infer<typeof reminderRulesOutput>;

export const completionBehaviorOutput = z.object({
	allowAddingNotes: z.boolean(),
	updateDealStage: z.boolean(),
	createFollowUpActivity: z.boolean(),
});
export type CompletionBehavior = z.infer<typeof completionBehaviorOutput>;

export const activityAssignmentRuleOutput = z.object({
	id: z.string(),
	name: z.string(),
	appliesTo: z.string(),
	condition: z.string(),
	assignTo: z.string(),
	status: z.boolean(),
});
export type ActivityAssignmentRule = z.infer<
	typeof activityAssignmentRuleOutput
>;

export const activitySettingsOverviewOutput = z.object({
	activityTypes: z.array(activityTypeItemOutput),
	defaultSettings: defaultActivitySettingsOutput,
	reminderRules: reminderRulesOutput,
	completionBehavior: completionBehaviorOutput,
	assignmentRules: z.array(activityAssignmentRuleOutput),
	members: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			role: z.string(),
		}),
	),
});
export type ActivitySettingsOverview = z.infer<
	typeof activitySettingsOverviewOutput
>;

export const createActivityTypeInput = z.object({
	name: z.string().trim().min(1).max(50),
	icon: z.string().default("checkmark"),
	iconColor: z.string().default("#22c55e"),
	defaultReminder: z.string().default("1 day before"),
	autoFollowUp: z.string().default("None"),
	status: z.boolean().default(true),
});
export type CreateActivityTypeInput = z.infer<typeof createActivityTypeInput>;

export const updateActivityTypeInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(50).optional(),
	icon: z.string().optional(),
	iconColor: z.string().optional(),
	defaultReminder: z.string().optional(),
	autoFollowUp: z.string().optional(),
	status: z.boolean().optional(),
});
export type UpdateActivityTypeInput = z.infer<typeof updateActivityTypeInput>;

export const deleteActivityTypeInput = z.object({
	id: z.string().min(1),
});
export type DeleteActivityTypeInput = z.infer<typeof deleteActivityTypeInput>;

export const updateDefaultActivitySettingsInput = z.object({
	defaultActivityType: z.string().optional(),
	defaultDuration: z.string().optional(),
	defaultReminderTime: z.string().optional(),
	defaultOwnerId: z.string().nullable().optional(),
	addToCalendar: z.boolean().optional(),
});
export type UpdateDefaultActivitySettingsInput = z.infer<
	typeof updateDefaultActivitySettingsInput
>;

export const updateReminderRulesInput = z.object({
	enableActivityReminders: z.boolean().optional(),
	emailReminders: z.boolean().optional(),
	overdueNotifications: z.boolean().optional(),
	timingOptions: z.array(z.string()).optional(),
});
export type UpdateReminderRulesInput = z.infer<typeof updateReminderRulesInput>;

export const updateCompletionBehaviorInput = z.object({
	allowAddingNotes: z.boolean().optional(),
	updateDealStage: z.boolean().optional(),
	createFollowUpActivity: z.boolean().optional(),
});
export type UpdateCompletionBehaviorInput = z.infer<
	typeof updateCompletionBehaviorInput
>;

export const createActivityAssignmentRuleInput = z.object({
	name: z.string().trim().min(1).max(120),
	appliesTo: z.string().trim().min(1).max(100),
	condition: z.string().trim().min(1).max(150),
	assignTo: z.string().trim().min(1).max(100),
	status: z.boolean().default(true),
});
export type CreateActivityAssignmentRuleInput = z.infer<
	typeof createActivityAssignmentRuleInput
>;

export const updateActivityAssignmentRuleInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(120).optional(),
	appliesTo: z.string().trim().min(1).max(100).optional(),
	condition: z.string().trim().min(1).max(150).optional(),
	assignTo: z.string().trim().min(1).max(100).optional(),
	status: z.boolean().optional(),
});
export type UpdateActivityAssignmentRuleInput = z.infer<
	typeof updateActivityAssignmentRuleInput
>;

export const deleteActivityAssignmentRuleInput = z.object({
	id: z.string().min(1),
});
export type DeleteActivityAssignmentRuleInput = z.infer<
	typeof deleteActivityAssignmentRuleInput
>;

export const DATA_ENTITIES = ["CONTACT", "COMPANY", "DEAL"] as const;

export const dataEntity = z.enum(DATA_ENTITIES);

export type DataEntity = z.infer<typeof dataEntity>;

export const backupItemOutput = z.object({
	id: z.string(),
	name: z.string(),
	createdAt: z.string(),
	sizeBytes: z.number(),
	recordCount: z.number(),
});
export type BackupItem = z.infer<typeof backupItemOutput>;

export const dataTransferOutput = z.object({
	id: z.string(),
	entity: dataEntity,
	filename: z.string().nullable(),
	rowCount: z.number(),
	failedCount: z.number(),
	createdAt: z.string(),
});

export const dataManagementOverviewOutput = z.object({
	summary: z.object({
		totalRecords: z.number(),
		importsLast30Days: z.number(),
		exportsLast30Days: z.number(),
		lastBackupAt: z.string().nullable(),
	}),
	backups: z.array(backupItemOutput),
	retentionDays: z.number(),
	recentImports: z.array(dataTransferOutput),
	canManage: z.boolean(),
});
export type DataManagementOverview = z.infer<
	typeof dataManagementOverviewOutput
>;

export const createBackupInput = z.object({
	name: z.string().trim().min(1).max(100),
});
export type CreateBackupInput = z.infer<typeof createBackupInput>;

export const backupIdInput = z.object({
	id: z.string().min(1),
});
export type BackupIdInput = z.infer<typeof backupIdInput>;

export const backupDownloadOutput = z.object({
	filename: z.string(),
	content: z.string(),
});

export const clearDeletedDataInput = z.object({
	entity: dataEntity.nullable(),
});
export type ClearDeletedDataInput = z.infer<typeof clearDeletedDataInput>;

export const clearDeletedDataOutput = z.object({
	purged: z.number(),
	skipped: z.number(),
	failed: z.number(),
});

export const INACTIVE_PERIOD_DAYS = [30, 60, 90, 365] as const;

export const archiveInactiveRecordsInput = z.object({
	days: z.union([
		z.literal(INACTIVE_PERIOD_DAYS[0]),
		z.literal(INACTIVE_PERIOD_DAYS[1]),
		z.literal(INACTIVE_PERIOD_DAYS[2]),
		z.literal(INACTIVE_PERIOD_DAYS[3]),
	]),
});
export type ArchiveInactiveRecordsInput = z.infer<
	typeof archiveInactiveRecordsInput
>;

export const archiveInactiveRecordsOutput = z.object({
	contacts: z.number(),
	deals: z.number(),
});

export const entityInput = z.object({
	entity: dataEntity,
});
export type EntityInput = z.infer<typeof entityInput>;

export const exportDataOutput = z.object({
	csv: z.string(),
	filename: z.string(),
	rowCount: z.number(),
});

export const importDataInput = z.object({
	entity: dataEntity,
	csv: z
		.string()
		.min(1, "The file is empty.")
		.max(DATA_MANAGEMENT.import.maxBytes, "The file is too large to import."),
	filename: z.string().trim().max(255).nullable(),
});
export type ImportDataInput = z.infer<typeof importDataInput>;

export const importDataOutput = z.object({
	created: z.number(),
	updated: z.number(),
	failed: z.number(),
	errors: z.array(z.object({ line: z.number(), message: z.string() })),
});

export const importTemplateOutput = z.object({
	csv: z.string(),
	filename: z.string(),
});

export const duplicateEntityInput = z.object({
	entity: z.enum(["CONTACT", "COMPANY"]),
});
export type DuplicateEntityInput = z.infer<typeof duplicateEntityInput>;

export const duplicateGroupsOutput = z.object({
	groups: z.array(
		z.object({
			key: z.string(),
			records: z.array(z.object({ id: z.string(), name: z.string() })),
		}),
	),
});
export type DuplicateGroups = z.infer<typeof duplicateGroupsOutput>;
