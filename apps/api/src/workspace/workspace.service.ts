import {
	appUrl,
	canChangeRole,
	canRenameWorkspace,
	ensureWorkspaceMembership,
	isWorkspaceAdmin,
	toWorkspaceRole,
	WORKSPACE_ID,
	WORKSPACE_ROLES,
	type WorkspaceRole,
	workspaceDomains,
	workspaceRoleOf,
} from "@crm/auth";
import { type Db, Prisma } from "@crm/db";
import { LeadSource, LeadStatus } from "@crm/db/enums";
import { isOnboarded, markOnboarded, workspaceSlug } from "@crm/db/workspace";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { normalizeDomain } from "../companies/domain";
import { InjectDatabase } from "../database/database.constants";
import {
	countsByKey,
	type ListResult,
	type OrderByColumns,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ActivityAssignmentRule,
	ActivitySettingsOverview,
	ActivityTypeItem,
	CompletionBehavior,
	CreateActivityAssignmentRuleInput,
	CreateActivityTypeInput,
	CreateLeadAssignmentRuleInput,
	CreateLeadFieldInput,
	CreateTeamInput,
	DefaultActivitySettings,
	DefaultLeadOwner,
	DeleteActivityAssignmentRuleInput,
	DeleteActivityTypeInput,
	DeleteLeadAssignmentRuleInput,
	DeleteLeadFieldInput,
	IntegrationItem,
	IntegrationsOverview,
	InvitationSettings,
	LeadAssignmentRuleItem,
	LeadFieldItem,
	LeadSettingsData,
	LeadSourceItem,
	LeadStatusItem,
	MemberListInput,
	ReminderRules,
	RoleItem,
	SetMemberRoleInput,
	TeamItem,
	ToggleIntegrationInput,
	UpdateActivityAssignmentRuleInput,
	UpdateActivityTypeInput,
	UpdateCompletionBehaviorInput,
	UpdateDefaultActivitySettingsInput,
	UpdateDefaultLeadOwnerInput,
	UpdateLeadAssignmentRuleInput,
	UpdateLeadFieldInput,
	UpdateMemberTeamInput,
	UpdateReminderRulesInput,
	UpdateWorkspaceInput,
	Workspace,
	WorkspaceMember,
} from "./workspace.contracts";
import { DAY_MS, MEMBERS } from "./workspace-config";

const MEMBER_SELECT = {
	id: true,
	role: true,
	createdAt: true,
	userId: true,
	team: { select: { teamId: true, team: { select: { name: true } } } },
	user: {
		select: {
			name: true,
			email: true,
			image: true,
			updatedAt: true,
			sessions: {
				orderBy: { updatedAt: "desc" },
				take: 1,
				select: { updatedAt: true },
			},
		},
	},
} as const;

type MemberRow = Prisma.MemberGetPayload<{ select: typeof MEMBER_SELECT }>;

const SORTABLE: OrderByColumns<Prisma.MemberOrderByWithRelationInput> = {
	name: (dir) => ({ user: { name: dir } }),
	email: (dir) => ({ user: { email: dir } }),
	role: (dir) => ({ role: dir }),
	joinedAt: (dir) => ({ createdAt: dir }),
};

const BASE_LEAD_FIELDS = [
	{
		id: "full-name",
		name: "Full Name",
		type: "text" as const,
		required: true,
		showInForm: true,
	},
	{
		id: "email",
		name: "Email",
		type: "email" as const,
		required: true,
		showInForm: true,
	},
	{
		id: "phone",
		name: "Phone",
		type: "phone" as const,
		required: true,
		showInForm: true,
	},
	{
		id: "company",
		name: "Company",
		type: "text" as const,
		required: true,
		showInForm: true,
	},
	{
		id: "job-title",
		name: "Job Title",
		type: "text" as const,
		required: false,
		showInForm: true,
	},
	{
		id: "company-size",
		name: "Company Size",
		type: "dropdown" as const,
		required: false,
		showInForm: true,
	},
	{
		id: "industry",
		name: "Industry",
		type: "dropdown" as const,
		required: false,
		showInForm: true,
	},
	{
		id: "notes",
		name: "Notes",
		type: "textarea" as const,
		required: false,
		showInForm: false,
	},
];

const BASE_LEAD_RULES = [
	{
		id: "rule-1",
		title: "Assign leads from Website to Sales team",
		description: "Source is Website",
		icon: "link",
		enabled: true,
	},
	{
		id: "rule-2",
		title: "Assign high-value leads to Rahul Kumar",
		description: "Company size > 500",
		icon: "building",
		enabled: true,
	},
	{
		id: "rule-3",
		title: "Assign LinkedIn leads to Priya Mehta",
		description: "Source is LinkedIn",
		icon: "social",
		enabled: true,
	},
	{
		id: "rule-4",
		title: "Round robin assignment",
		description: "Distribute leads equally among team members",
		icon: "users",
		enabled: false,
	},
];

const BASE_ACTIVITY_TYPES: ActivityTypeItem[] = [
	{
		id: "task",
		name: "Task",
		icon: "checkmark",
		iconColor: "#22c55e",
		defaultReminder: "1 day before",
		autoFollowUp: "None",
		status: true,
	},
	{
		id: "call",
		name: "Call",
		icon: "phone",
		iconColor: "#3b82f6",
		defaultReminder: "15 minutes before",
		autoFollowUp: "Log outcome",
		status: true,
	},
	{
		id: "meeting",
		name: "Meeting",
		icon: "calendar",
		iconColor: "#8b5cf6",
		defaultReminder: "1 hour before",
		autoFollowUp: "Send follow-up email",
		status: true,
	},
	{
		id: "email",
		name: "Email",
		icon: "email",
		iconColor: "#f59e0b",
		defaultReminder: "No reminder",
		autoFollowUp: "None",
		status: true,
	},
	{
		id: "follow-up",
		name: "Follow-up",
		icon: "sync",
		iconColor: "#ef4444",
		defaultReminder: "1 day before",
		autoFollowUp: "Create new task",
		status: true,
	},
];

const BASE_ACTIVITY_ASSIGNMENT_RULES: ActivityAssignmentRule[] = [
	{
		id: "rule-1",
		name: "Website Enquiry",
		appliesTo: "All Activities",
		condition: "Lead source is Website",
		assignTo: "Sales Team (Round Robin)",
		status: true,
	},
	{
		id: "rule-2",
		name: "High Value Leads",
		appliesTo: "Calls, Meetings",
		condition: "Deal value > ₹1,00,000",
		assignTo: "Rahul Kumar",
		status: true,
	},
	{
		id: "rule-3",
		name: "Product Specific",
		appliesTo: "Tasks, Calls",
		condition: "Product is Appbar",
		assignTo: "Product Team",
		status: false,
	},
];

@Injectable()
export class WorkspaceService {
	private readonly logger = new Logger(WorkspaceService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
	) {}

	async get(userId: string): Promise<Workspace> {
		let row = await this.readWorkspace();

		if (!row) {
			await ensureWorkspaceMembership(userId);
			row = await this.readWorkspace();
		}

		if (!row) {
			throw new ServiceUnavailableException(
				"The workspace could not be read. Sign in again in a moment.",
			);
		}

		const role = await workspaceRoleOf(userId, this.db);
		let meta: Record<string, any> = {};
		try {
			if (row.metadata) meta = JSON.parse(row.metadata);
		} catch {
			meta = {};
		}

		return {
			id: row.id,
			slug: row.slug,
			name: row.name,
			website: row.website,
			industry: meta.industry || "Technology",
			companySize: meta.companySize || "11-50 employees",
			description: meta.description || "",
			logoUrl: meta.logoUrl || null,
			timezone: meta.timezone || "(GMT+05:30) Asia/Kolkata",
			dateFormat: meta.dateFormat || "25 Sep 2025",
			timeFormat: meta.timeFormat || "12-hour (AM/PM)",
			currency: meta.currency || "INR",
			preferences: {
				showProductFilterInAllModules:
					meta.preferences?.showProductFilterInAllModules ?? true,
				enableEmailNotifications:
					meta.preferences?.enableEmailNotifications ?? true,
				autoAssignNewLeads: meta.preferences?.autoAssignNewLeads ?? false,
				enableDesktopNotifications:
					meta.preferences?.enableDesktopNotifications ?? true,
				allowDuplicateLeads: meta.preferences?.allowDuplicateLeads ?? false,
				setFollowUpReminders: meta.preferences?.setFollowUpReminders ?? true,
			},
			onboarded: isOnboarded(row.metadata),
			viewerRole: role,
			canRename: canRenameWorkspace(role),
			canChangeRoles: canChangeRole(role),
		};
	}

	async update(
		userId: string,
		input: UpdateWorkspaceInput,
	): Promise<Workspace> {
		const role = await workspaceRoleOf(userId, this.db);

		if (!canRenameWorkspace(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change the workspace.",
			);
		}

		const before = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { website: true, metadata: true },
		});

		const website = normalizeDomain(input.website);

		if (!website) {
			throw new BadRequestException(
				"That is not a website. Enter the domain, like acme.com.",
			);
		}

		let currentMeta: Record<string, any> = {};
		try {
			if (before?.metadata) currentMeta = JSON.parse(before.metadata);
		} catch {
			currentMeta = {};
		}

		const updatedMeta = {
			...currentMeta,
			...(input.industry !== undefined && { industry: input.industry }),
			...(input.companySize !== undefined && {
				companySize: input.companySize,
			}),
			...(input.description !== undefined && {
				description: input.description,
			}),
			...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
			...(input.timezone !== undefined && { timezone: input.timezone }),
			...(input.dateFormat !== undefined && { dateFormat: input.dateFormat }),
			...(input.timeFormat !== undefined && { timeFormat: input.timeFormat }),
			...(input.currency !== undefined && { currency: input.currency }),
			...(input.preferences !== undefined && {
				preferences: {
					...currentMeta.preferences,
					...input.preferences,
				},
			}),
		};

		const finalMetadataStr = markOnboarded(
			JSON.stringify(updatedMeta),
			new Date(),
		);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: {
				name: input.name,
				slug: workspaceSlug(input.slug ?? input.name),
				website,
				metadata: finalMetadataStr,
			},
		});

		this.logger.log({ message: "Workspace updated", userId });

		if (website !== before?.website) {
			await this.agent.workspaceChanged(
				website,
				before?.website
					? "The company using this CRM changed its website"
					: "The company using this CRM said what its website is",
			);
		}

		return this.get(userId);
	}

	async members(
		userId: string,
		input: MemberListInput,
	): Promise<ListResult<WorkspaceMember>> {
		const activeSince = this.activeSince();
		const where = this.buildWhere(input, activeSince);
		const { skip, take } = paginate(input);

		const [rows, total, roles] = await Promise.all([
			this.db.member.findMany({
				where,
				skip,
				take,
				select: MEMBER_SELECT,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "asc" }),
			}),
			this.db.member.count({ where }),
			this.db.member.groupBy({
				by: ["role"],
				where: this.searchWhere(input.q),
				_count: { _all: true },
			}),
		]);

		return {
			rows: rows.map((row) => this.toMember(row, userId, activeSince)),
			total,
			facetCounts: { role: countsByKey(roles, "role") },
		};
	}

	async teams(): Promise<TeamItem[]> {
		const teams = await this.db.team.findMany({
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				_count: { select: { members: true } },
			},
		});

		return teams.map((team) => ({
			id: team.id,
			name: team.name,
			memberCount: team._count.members,
		}));
	}

	async roles(): Promise<RoleItem[]> {
		const grouped = await this.db.member.groupBy({
			by: ["role"],
			where: { organizationId: WORKSPACE_ID },
			_count: { _all: true },
		});

		const counts = new Map<WorkspaceRole, number>();
		for (const row of grouped) {
			const role = toWorkspaceRole(row.role);
			counts.set(role, (counts.get(role) ?? 0) + row._count._all);
		}

		return WORKSPACE_ROLES.map((role) => ({
			id: role,
			userCount: counts.get(role) ?? 0,
		}));
	}

	async createTeam(userId: string, input: CreateTeamInput): Promise<TeamItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can add a team.",
		);

		try {
			const team = await this.db.team.create({
				data: { name: input.name },
				select: { id: true, name: true },
			});

			this.logger.log({ message: "Team created", userId, teamId: team.id });

			return { ...team, memberCount: 0 };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new BadRequestException("A team with that name already exists.");
			}
			throw error;
		}
	}

	async leadSettings(userId: string): Promise<LeadSettingsData> {
		const row = await this.readWorkspace();
		let leadMeta: Record<string, any> = {};
		try {
			if (row?.metadata) {
				const meta = JSON.parse(row.metadata);
				if (meta.leadSettings) leadMeta = meta.leadSettings;
			}
		} catch {}

		const [sourceGroups, statusGroups] = await Promise.all([
			this.db.contact.groupBy({
				by: ["leadSource"],
				where: { archivedAt: null },
				_count: { _all: true },
			}),
			this.db.contact.groupBy({
				by: ["leadStatus"],
				where: { archivedAt: null },
				_count: { _all: true },
			}),
		]);

		const sourceCounts = new Map(
			sourceGroups.map((group) => [group.leadSource, group._count._all]),
		);
		const statusCounts = new Map(
			statusGroups.map((group) => [group.leadStatus, group._count._all]),
		);

		const sources: LeadSourceItem[] = Object.values(LeadSource).map(
			(source) => ({ id: source, leadsCount: sourceCounts.get(source) ?? 0 }),
		);
		const unsourcedCount = sourceCounts.get(null) ?? 0;

		const statuses: LeadStatusItem[] = Object.values(LeadStatus).map(
			(status) => ({ id: status, leadsCount: statusCounts.get(status) ?? 0 }),
		);

		const customFields: LeadFieldItem[] = Array.isArray(leadMeta.fields)
			? leadMeta.fields
			: [];
		const fieldsList = [
			...BASE_LEAD_FIELDS.map((f) => ({ ...f, isCustom: false })),
			...customFields
				.filter((cf) => !BASE_LEAD_FIELDS.some((bf) => bf.id === cf.id))
				.map((f) => ({ ...f, isCustom: true })),
		];
		const fields: LeadFieldItem[] = fieldsList.map((f) => {
			const override = customFields.find((cf) => cf.id === f.id);
			return {
				id: f.id,
				name: override?.name ?? f.name,
				type: override?.type ?? f.type,
				required: override?.required ?? f.required,
				showInForm: override?.showInForm ?? f.showInForm,
				isCustom: f.isCustom ?? false,
			};
		});

		const customRules: LeadAssignmentRuleItem[] = Array.isArray(
			leadMeta.assignmentRules,
		)
			? leadMeta.assignmentRules
			: [];
		const rulesList = [
			...BASE_LEAD_RULES,
			...customRules.filter(
				(cr) => !BASE_LEAD_RULES.some((br) => br.id === cr.id),
			),
		];
		const assignmentRules: LeadAssignmentRuleItem[] = rulesList.map((r) => {
			const override = customRules.find((cr) => cr.id === r.id);
			return {
				id: r.id,
				title: override?.title ?? r.title,
				description: override?.description ?? r.description,
				icon: override?.icon ?? r.icon,
				enabled: override?.enabled ?? r.enabled,
			};
		});

		let defaultOwner: DefaultLeadOwner = {
			userId: null,
			name: null,
			role: null,
			image: null,
		};
		const targetOwnerId = leadMeta.defaultOwnerId;
		if (targetOwnerId) {
			const member = await this.db.member.findFirst({
				where: { userId: targetOwnerId, organizationId: WORKSPACE_ID },
				include: { user: true },
			});
			if (member) {
				defaultOwner = {
					userId: member.userId,
					name: member.user.name,
					role: member.role,
					image: member.user.image,
				};
			}
		}

		if (!defaultOwner.userId) {
			const firstMember = await this.db.member.findFirst({
				where: { organizationId: WORKSPACE_ID },
				include: { user: true },
				orderBy: { createdAt: "asc" },
			});
			if (firstMember) {
				defaultOwner = {
					userId: firstMember.userId,
					name: firstMember.user.name,
					role: firstMember.role,
					image: firstMember.user.image,
				};
			}
		}

		return {
			sources,
			unsourcedCount,
			fields,
			statuses,
			assignmentRules,
			defaultOwner,
		};
	}

	async createLeadField(
		userId: string,
		input: CreateLeadFieldInput,
	): Promise<LeadFieldItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const fieldId = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const newField: LeadFieldItem = {
			id: fieldId,
			name: input.name,
			type: input.type,
			required: input.required,
			showInForm: input.showInForm,
			isCustom: true,
		};

		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.fields)
			? leadSettings.fields
			: [];
		leadSettings.fields = [
			...existing.filter((f) => f.id !== fieldId),
			newField,
		];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return newField;
	}

	async updateLeadField(
		userId: string,
		input: UpdateLeadFieldInput,
	): Promise<LeadFieldItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.fields)
			? leadSettings.fields
			: [];

		const base = BASE_LEAD_FIELDS.find((f) => f.id === input.id);
		const prev = existing.find((f) => f.id === input.id);

		const updated: LeadFieldItem = {
			id: input.id,
			name: input.name ?? prev?.name ?? base?.name ?? input.id,
			type: input.type ?? prev?.type ?? base?.type ?? "text",
			required: input.required ?? prev?.required ?? base?.required ?? false,
			showInForm:
				input.showInForm ?? prev?.showInForm ?? base?.showInForm ?? true,
			isCustom: prev?.isCustom ?? !base,
		};

		leadSettings.fields = [
			...existing.filter((f) => f.id !== input.id),
			updated,
		];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return updated;
	}

	async deleteLeadField(
		userId: string,
		input: DeleteLeadFieldInput,
	): Promise<{ success: boolean }> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.fields)
			? leadSettings.fields
			: [];
		leadSettings.fields = existing.filter((f) => f.id !== input.id);
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return { success: true };
	}

	async createLeadAssignmentRule(
		userId: string,
		input: CreateLeadAssignmentRuleInput,
	): Promise<LeadAssignmentRuleItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const ruleId = "rule-" + crypto.randomUUID().slice(0, 8);
		const newRule: LeadAssignmentRuleItem = {
			id: ruleId,
			title: input.title,
			description: input.description,
			icon: input.icon || "link",
			enabled: input.enabled,
		};

		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.assignmentRules)
			? leadSettings.assignmentRules
			: [];
		leadSettings.assignmentRules = [...existing, newRule];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return newRule;
	}

	async updateLeadAssignmentRule(
		userId: string,
		input: UpdateLeadAssignmentRuleInput,
	): Promise<LeadAssignmentRuleItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.assignmentRules)
			? leadSettings.assignmentRules
			: [];

		const base = BASE_LEAD_RULES.find((r) => r.id === input.id);
		const prev = existing.find((r) => r.id === input.id);

		const updated: LeadAssignmentRuleItem = {
			id: input.id,
			title: input.title ?? prev?.title ?? base?.title ?? "Assignment Rule",
			description:
				input.description ?? prev?.description ?? base?.description ?? "",
			icon: input.icon ?? prev?.icon ?? base?.icon ?? "link",
			enabled: input.enabled ?? prev?.enabled ?? base?.enabled ?? true,
		};

		leadSettings.assignmentRules = [
			...existing.filter((r) => r.id !== input.id),
			updated,
		];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return updated;
	}

	async deleteLeadAssignmentRule(
		userId: string,
		input: DeleteLeadAssignmentRuleInput,
	): Promise<{ success: boolean }> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.assignmentRules)
			? leadSettings.assignmentRules
			: [];
		leadSettings.assignmentRules = existing.filter((r) => r.id !== input.id);
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return { success: true };
	}

	async updateDefaultLeadOwner(
		userId: string,
		input: UpdateDefaultLeadOwnerInput,
	): Promise<DefaultLeadOwner> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const leadSettings = meta.leadSettings || {};
		leadSettings.defaultOwnerId = input.userId;
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		if (input.userId) {
			const member = await this.db.member.findFirst({
				where: { userId: input.userId, organizationId: WORKSPACE_ID },
				include: { user: true },
			});
			if (member) {
				return {
					userId: member.userId,
					name: member.user.name,
					role: member.role,
					image: member.user.image,
				};
			}
		}

		return { userId: null, name: null, role: null, image: null };
	}

	invitationSettings(): InvitationSettings {
		return {
			signInUrl: new URL("/sign-in", appUrl).toString(),
			allowedDomains: [...workspaceDomains()],
			defaultRole: "member",
		};
	}

	async integrations(userId: string): Promise<IntegrationsOverview> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const customIntegrations = meta.integrations || {};

		const [googleSync, msSync, slackSync] = await Promise.all([
			this.db.mailboxSync.findFirst({
				where: { source: "google" },
				select: { id: true, user: { select: { email: true } } },
			}),
			this.db.mailboxSync.findFirst({
				where: { source: "outlook" },
				select: { id: true, user: { select: { email: true } } },
			}),
			this.db.slackInstallation.findFirst({
				select: { teamName: true },
			}),
		]);

		const isGoogleConnected = Boolean(googleSync);
		const isMsConnected = Boolean(msSync);
		const isSlackConnected = Boolean(slackSync);

		const items: IntegrationItem[] = [
			// Communication & Email
			{
				id: "gmail",
				name: "Gmail",
				category: "communication",
				description:
					"Sync emails, track conversations and log emails as CRM activities.",
				status:
					(customIntegrations.gmail?.connected ?? isGoogleConnected)
						? "connected"
						: "not_connected",
				connected: customIntegrations.gmail?.connected ?? isGoogleConnected,
				enabled: customIntegrations.gmail?.enabled ?? isGoogleConnected,
				accountName: googleSync?.user?.email ?? null,
				settingsUrl: "connections/google",
			},
			{
				id: "outlook",
				name: "Outlook",
				category: "communication",
				description:
					"Sync emails, calendar events and create activities automatically.",
				status:
					(customIntegrations.outlook?.connected ?? isMsConnected)
						? "connected"
						: "not_connected",
				connected: customIntegrations.outlook?.connected ?? isMsConnected,
				enabled: customIntegrations.outlook?.enabled ?? isMsConnected,
				accountName: msSync?.user?.email ?? null,
				settingsUrl: "connections/microsoft",
			},
			{
				id: "google-calendar",
				name: "Google Calendar",
				category: "communication",
				description:
					"Sync meetings, create activities and get reminders in your calendar.",
				status:
					(customIntegrations["google-calendar"]?.connected ??
					isGoogleConnected)
						? "connected"
						: "not_connected",
				connected:
					customIntegrations["google-calendar"]?.connected ?? isGoogleConnected,
				enabled:
					customIntegrations["google-calendar"]?.enabled ?? isGoogleConnected,
				accountName: googleSync?.user?.email ?? null,
				settingsUrl: "connections/google",
			},
			// Collaboration & Productivity
			{
				id: "slack",
				name: "Slack",
				category: "collaboration",
				description:
					"Get notifications, share deal updates and create leads from Slack.",
				status:
					(customIntegrations.slack?.connected ?? isSlackConnected)
						? "connected"
						: "not_connected",
				connected: customIntegrations.slack?.connected ?? isSlackConnected,
				enabled: customIntegrations.slack?.enabled ?? isSlackConnected,
				accountName: slackSync?.teamName ?? null,
				settingsUrl: "connections/slack",
			},
			{
				id: "teams",
				name: "Microsoft Teams",
				category: "collaboration",
				description:
					"Get notifications and collaborate on deals with your team.",
				status:
					(customIntegrations.teams?.connected ?? isMsConnected)
						? "connected"
						: "not_connected",
				connected: customIntegrations.teams?.connected ?? isMsConnected,
				enabled: customIntegrations.teams?.enabled ?? isMsConnected,
				accountName: msSync?.user?.email ?? null,
				settingsUrl: "connections/microsoft",
			},
			{
				id: "notion",
				name: "Notion",
				category: "collaboration",
				description: "Sync notes, documents and meeting notes with your CRM.",
				status: customIntegrations.notion?.connected
					? "connected"
					: "not_connected",
				connected: Boolean(customIntegrations.notion?.connected),
				enabled: Boolean(customIntegrations.notion?.enabled),
				settingsUrl: null,
			},
			// Marketing & Lead Capture
			{
				id: "hubspot",
				name: "HubSpot",
				category: "marketing",
				description:
					"Sync leads, contacts and marketing activities with GISUL CRM.",
				status: customIntegrations.hubspot?.connected
					? "connected"
					: "not_connected",
				connected: Boolean(customIntegrations.hubspot?.connected),
				enabled: Boolean(customIntegrations.hubspot?.enabled),
				settingsUrl: null,
			},
			{
				id: "linkedin",
				name: "LinkedIn",
				category: "marketing",
				description: "Capture leads from LinkedIn and sync with your CRM.",
				status:
					(customIntegrations.linkedin?.connected ?? true)
						? "connected"
						: "not_connected",
				connected: customIntegrations.linkedin?.connected ?? true,
				enabled: customIntegrations.linkedin?.enabled ?? true,
				settingsUrl: null,
			},
			{
				id: "meta-ads",
				name: "Meta Ads",
				category: "marketing",
				description:
					"Automatically capture leads from your Facebook and Instagram ads.",
				status: customIntegrations["meta-ads"]?.connected
					? "connected"
					: "not_connected",
				connected: Boolean(customIntegrations["meta-ads"]?.connected),
				enabled: Boolean(customIntegrations["meta-ads"]?.enabled),
				settingsUrl: null,
			},
			// Development & Custom
			{
				id: "zapier",
				name: "Zapier",
				category: "development",
				description: "Automate workflows between GISUL CRM and 5000+ apps.",
				status: customIntegrations.zapier?.connected
					? "connected"
					: "not_connected",
				connected: Boolean(customIntegrations.zapier?.connected),
				enabled: Boolean(customIntegrations.zapier?.enabled),
				settingsUrl: null,
			},
			{
				id: "api-access",
				name: "API Access",
				category: "development",
				description: "Use GISUL CRM API to build custom integrations.",
				status: "enabled",
				connected: true,
				enabled: customIntegrations["api-access"]?.enabled ?? true,
				settingsUrl: "api-keys",
			},
		];

		const total = items.length;
		const connected = items.filter((i) => i.connected).length;
		const notConnected = items.filter((i) => !i.connected).length;
		const available = 2;

		return {
			summary: {
				total,
				connected,
				available,
				notConnected,
			},
			integrations: items,
		};
	}

	async toggleIntegration(
		userId: string,
		input: ToggleIntegrationInput,
	): Promise<IntegrationItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}
		const customIntegrations = meta.integrations || {};

		customIntegrations[input.id] = {
			...(customIntegrations[input.id] || {}),
			enabled: input.enabled,
			connected: input.enabled,
		};
		meta.integrations = customIntegrations;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		const overview = await this.integrations(userId);
		const target = overview.integrations.find((i) => i.id === input.id);
		if (!target) throw new NotFoundException("Integration not found");
		return target;
	}

	async activitySettings(userId: string): Promise<ActivitySettingsOverview> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const membersList = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: {
				id: true,
				role: true,
				userId: true,
				user: { select: { name: true } },
			},
		});

		const members = membersList.map((m) => ({
			id: m.userId,
			name: m.user.name,
			role: m.role,
		}));

		const customTypes: ActivityTypeItem[] =
			meta.activityTypes || BASE_ACTIVITY_TYPES;
		const defaultOwnerId =
			meta.activityDefaultSettings?.defaultOwnerId ??
			membersList[0]?.userId ??
			null;
		const defaultOwnerMember = membersList.find(
			(m) => m.userId === defaultOwnerId,
		);
		const defaultOwnerName = defaultOwnerMember
			? `${defaultOwnerMember.user.name} (${defaultOwnerMember.role})`
			: "Rahul Kumar (Sales Manager)";

		const defaultSettings: DefaultActivitySettings = {
			defaultActivityType:
				meta.activityDefaultSettings?.defaultActivityType ?? "task",
			defaultDuration:
				meta.activityDefaultSettings?.defaultDuration ?? "30 minutes",
			defaultReminderTime:
				meta.activityDefaultSettings?.defaultReminderTime ?? "1 day before",
			defaultOwnerId,
			defaultOwnerName,
			addToCalendar: meta.activityDefaultSettings?.addToCalendar ?? true,
		};

		const reminderRules: ReminderRules = {
			enableActivityReminders:
				meta.activityReminderRules?.enableActivityReminders ?? true,
			emailReminders: meta.activityReminderRules?.emailReminders ?? true,
			overdueNotifications:
				meta.activityReminderRules?.overdueNotifications ?? true,
			timingOptions: meta.activityReminderRules?.timingOptions ?? [
				"1 day before",
			],
		};

		const completionBehavior: CompletionBehavior = {
			allowAddingNotes:
				meta.activityCompletionBehavior?.allowAddingNotes ?? true,
			updateDealStage: meta.activityCompletionBehavior?.updateDealStage ?? true,
			createFollowUpActivity:
				meta.activityCompletionBehavior?.createFollowUpActivity ?? true,
		};

		const assignmentRules: ActivityAssignmentRule[] =
			meta.activityAssignmentRules || BASE_ACTIVITY_ASSIGNMENT_RULES;

		return {
			activityTypes: customTypes,
			defaultSettings,
			reminderRules,
			completionBehavior,
			assignmentRules,
			members,
		};
	}

	async updateDefaultActivitySettings(
		userId: string,
		input: UpdateDefaultActivitySettingsInput,
	): Promise<DefaultActivitySettings> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		meta.activityDefaultSettings = {
			...(meta.activityDefaultSettings || {}),
			...input,
		};

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		const res = await this.activitySettings(userId);
		return res.defaultSettings;
	}

	async updateReminderRules(
		userId: string,
		input: UpdateReminderRulesInput,
	): Promise<ReminderRules> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		meta.activityReminderRules = {
			...(meta.activityReminderRules || {}),
			...input,
		};

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		const res = await this.activitySettings(userId);
		return res.reminderRules;
	}

	async updateCompletionBehavior(
		userId: string,
		input: UpdateCompletionBehaviorInput,
	): Promise<CompletionBehavior> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		meta.activityCompletionBehavior = {
			...(meta.activityCompletionBehavior || {}),
			...input,
		};

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		const res = await this.activitySettings(userId);
		return res.completionBehavior;
	}

	async createActivityType(
		userId: string,
		input: CreateActivityTypeInput,
	): Promise<ActivityTypeItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityTypeItem[] = meta.activityTypes || [
			...BASE_ACTIVITY_TYPES,
		];
		const id = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const newItem: ActivityTypeItem = {
			id: current.some((c) => c.id === id) ? `${id}-${Date.now()}` : id,
			name: input.name,
			icon: input.icon || "checkmark",
			iconColor: input.iconColor || "#22c55e",
			defaultReminder: input.defaultReminder || "1 day before",
			autoFollowUp: input.autoFollowUp || "None",
			status: input.status ?? true,
		};
		meta.activityTypes = [...current, newItem];

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return newItem;
	}

	async updateActivityType(
		userId: string,
		input: UpdateActivityTypeInput,
	): Promise<ActivityTypeItem> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityTypeItem[] = meta.activityTypes || [
			...BASE_ACTIVITY_TYPES,
		];
		const existing = current.find((c) => c.id === input.id);
		if (!existing) throw new NotFoundException("Activity type not found");

		const updated = {
			...existing,
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.icon !== undefined ? { icon: input.icon } : {}),
			...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
			...(input.defaultReminder !== undefined
				? { defaultReminder: input.defaultReminder }
				: {}),
			...(input.autoFollowUp !== undefined
				? { autoFollowUp: input.autoFollowUp }
				: {}),
			...(input.status !== undefined ? { status: input.status } : {}),
		};
		meta.activityTypes = current.map((c) => (c.id === input.id ? updated : c));

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return updated;
	}

	async deleteActivityType(
		userId: string,
		input: DeleteActivityTypeInput,
	): Promise<{ success: boolean }> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityTypeItem[] = meta.activityTypes || [
			...BASE_ACTIVITY_TYPES,
		];
		meta.activityTypes = current.filter((c) => c.id !== input.id);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return { success: true };
	}

	async createActivityAssignmentRule(
		userId: string,
		input: CreateActivityAssignmentRuleInput,
	): Promise<ActivityAssignmentRule> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityAssignmentRule[] = meta.activityAssignmentRules || [
			...BASE_ACTIVITY_ASSIGNMENT_RULES,
		];
		const newRule: ActivityAssignmentRule = {
			id: `rule-${Date.now()}`,
			name: input.name,
			appliesTo: input.appliesTo,
			condition: input.condition,
			assignTo: input.assignTo,
			status: input.status ?? true,
		};
		meta.activityAssignmentRules = [...current, newRule];

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return newRule;
	}

	async updateActivityAssignmentRule(
		userId: string,
		input: UpdateActivityAssignmentRuleInput,
	): Promise<ActivityAssignmentRule> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityAssignmentRule[] = meta.activityAssignmentRules || [
			...BASE_ACTIVITY_ASSIGNMENT_RULES,
		];
		const existing = current.find((c) => c.id === input.id);
		if (!existing) throw new NotFoundException("Assignment rule not found");

		const updated = {
			...existing,
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.appliesTo !== undefined ? { appliesTo: input.appliesTo } : {}),
			...(input.condition !== undefined ? { condition: input.condition } : {}),
			...(input.assignTo !== undefined ? { assignTo: input.assignTo } : {}),
			...(input.status !== undefined ? { status: input.status } : {}),
		};
		meta.activityAssignmentRules = current.map((c) =>
			c.id === input.id ? updated : c,
		);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return updated;
	}

	async deleteActivityAssignmentRule(
		userId: string,
		input: DeleteActivityAssignmentRuleInput,
	): Promise<{ success: boolean }> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change workspace settings.",
		);
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityAssignmentRule[] = meta.activityAssignmentRules || [
			...BASE_ACTIVITY_ASSIGNMENT_RULES,
		];
		meta.activityAssignmentRules = current.filter((c) => c.id !== input.id);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return { success: true };
	}

	async updateMemberTeam(
		userId: string,
		input: UpdateMemberTeamInput,
	): Promise<WorkspaceMember> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change a member's team.",
		);

		const member = await this.db.member.findFirst({
			where: { id: input.memberId, organizationId: WORKSPACE_ID },
			select: { id: true },
		});
		if (!member) {
			throw new NotFoundException("That person is not in this workspace.");
		}

		if (input.teamId === null) {
			await this.db.memberTeam.deleteMany({ where: { memberId: member.id } });
		} else {
			const team = await this.db.team.findUnique({
				where: { id: input.teamId },
				select: { id: true },
			});
			if (!team) throw new NotFoundException("That team does not exist.");

			await this.db.memberTeam.upsert({
				where: { memberId: member.id },
				create: { memberId: member.id, teamId: team.id },
				update: { teamId: team.id },
			});
		}

		this.logger.log({
			message: "Member team changed",
			userId,
			memberId: member.id,
			teamId: input.teamId,
		});

		const row = await this.db.member.findUniqueOrThrow({
			where: { id: member.id },
			select: MEMBER_SELECT,
		});

		return this.toMember(row, userId, this.activeSince());
	}

	async setMemberRole(
		userId: string,
		input: SetMemberRoleInput,
	): Promise<WorkspaceMember> {
		const role = await workspaceRoleOf(userId, this.db);

		if (!canChangeRole(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change a member's role.",
			);
		}

		const updated = await this.db.$transaction(async (tx) => {
			const target = await tx.member.findFirst({
				where: { id: input.memberId, organizationId: WORKSPACE_ID },
				select: { id: true, role: true },
			});

			if (!target) {
				throw new NotFoundException("That person is not in this workspace.");
			}

			if (target.role === "owner" && input.role !== "owner") {
				const owners = await tx.$queryRaw<{ id: string }[]>`
					SELECT id FROM "member"
					WHERE "organizationId" = ${WORKSPACE_ID} AND role = 'owner'
					FOR UPDATE
				`;

				if (owners.length <= 1) {
					throw new ForbiddenException(
						"The workspace needs an owner. Make someone else an owner first.",
					);
				}
			}

			return tx.member.update({
				where: { id: target.id },
				data: { role: input.role },
				select: MEMBER_SELECT,
			});
		});

		this.logger.log({
			message: "Workspace role changed",
			userId,
			memberId: updated.id,
			role: input.role,
		});

		return this.toMember(updated, userId, this.activeSince());
	}

	private toMember(
		row: MemberRow,
		viewerId: string,
		activeSince: Date,
	): WorkspaceMember {
		const lastActive = row.user.sessions[0]?.updatedAt ?? null;

		return {
			id: row.id,
			userId: row.userId,
			name: row.user.name,
			email: row.user.email,
			image: row.user.image,
			role: toWorkspaceRole(row.role),
			teamId: row.team?.teamId ?? null,
			team: row.team?.team.name ?? null,
			status: lastActive && lastActive >= activeSince ? "active" : "inactive",
			lastActive: lastActive ? lastActive.toISOString() : null,
			joinedAt: row.createdAt.toISOString(),
			isViewer: row.userId === viewerId,
		};
	}

	private activeSince(): Date {
		return new Date(Date.now() - MEMBERS.activeWithinDays * DAY_MS);
	}

	private async requireAdmin(userId: string, message: string): Promise<void> {
		const role = await workspaceRoleOf(userId, this.db);
		if (!isWorkspaceAdmin(role)) throw new ForbiddenException(message);
	}

	private searchWhere(q: string): Prisma.MemberWhereInput {
		const term = q.trim();
		const where: Prisma.MemberWhereInput = { organizationId: WORKSPACE_ID };

		if (term) {
			where.user = {
				OR: [
					{ name: { contains: term, mode: "insensitive" } },
					{ email: { contains: term, mode: "insensitive" } },
				],
			};
		}

		return where;
	}

	private buildWhere(
		input: MemberListInput,
		activeSince: Date,
	): Prisma.MemberWhereInput {
		const where = this.searchWhere(input.q);
		const and: Prisma.MemberWhereInput[] = [];

		if (input.role.length > 0) {
			and.push({ role: { in: input.role } });
		}

		if (input.team.length > 0) {
			and.push({ team: { teamId: { in: input.team } } });
		}

		const wantsActive = input.status.includes("active");
		const wantsInactive = input.status.includes("inactive");
		const recent = { updatedAt: { gte: activeSince } };

		if (wantsActive && !wantsInactive) {
			and.push({ user: { sessions: { some: recent } } });
		}
		if (wantsInactive && !wantsActive) {
			and.push({ user: { sessions: { none: recent } } });
		}

		if (and.length > 0) where.AND = and;

		return where;
	}

	private async readWorkspace() {
		return this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: {
				id: true,
				slug: true,
				name: true,
				website: true,
				metadata: true,
			},
		});
	}
}
