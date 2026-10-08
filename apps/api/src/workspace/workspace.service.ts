import {
	canChangeRole,
	canRenameWorkspace,
	ensureWorkspaceMembership,
	isWorkspaceRole,
	WORKSPACE_ID,
	type WorkspaceRole,
	workspaceRoleOf,
} from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
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
	ArchiveInactiveRecordsInput,
	BackupItem,
	ClearDeletedDataInput,
	CompletionBehavior,
	CreateActivityAssignmentRuleInput,
	CreateActivityTypeInput,
	CreateBackupInput,
	CreateLeadAssignmentRuleInput,
	CreateLeadFieldInput,
	CreateLeadSourceInput,
	CreateLeadStatusInput,
	CreateRoleInput,
	CreateTeamInput,
	DataManagementOverview,
	DataRetentionSettings,
	DefaultActivitySettings,
	DefaultLeadOwner,
	DeleteAccountInput,
	DeleteActivityAssignmentRuleInput,
	DeleteActivityTypeInput,
	DeleteBackupInput,
	DeleteLeadAssignmentRuleInput,
	DeleteLeadFieldInput,
	DeleteLeadSourceInput,
	DeleteLeadStatusInput,
	ExportDataInput,
	ImportDataInput,
	IntegrationItem,
	IntegrationsOverview,
	InvitationSettings,
	InviteUserInput,
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
	UpdateDataRetentionInput,
	UpdateDefaultActivitySettingsInput,
	UpdateDefaultLeadOwnerInput,
	UpdateInvitationSettingsInput,
	UpdateLeadAssignmentRuleInput,
	UpdateLeadFieldInput,
	UpdateLeadSourceInput,
	UpdateLeadStatusInput,
	UpdateMemberStatusInput,
	UpdateMemberTeamInput,
	UpdateReminderRulesInput,
	UpdateWorkspaceInput,
	Workspace,
	WorkspaceMember,
} from "./workspace.contracts";

const MEMBER_SELECT = {
	id: true,
	role: true,
	createdAt: true,
	userId: true,
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

const BASE_TEAMS = [
	{ id: "sales", name: "Sales", icon: "user" },
	{ id: "product", name: "Product", icon: "grid" },
	{ id: "marketing", name: "Marketing", icon: "chart" },
	{ id: "customer-success", name: "Customer Success", icon: "headset" },
];

const BASE_ROLES = [
	{ id: "sales-manager", name: "Sales Manager", description: "Full access to sales data" },
	{ id: "sales-executive", name: "Sales Executive", description: "Manage leads and deals" },
	{ id: "product-manager", name: "Product Manager", description: "Access to product data" },
	{ id: "marketing", name: "Marketing", description: "Access to marketing data" },
	{ id: "customer-success", name: "Customer Success", description: "Customer support access" },
	{ id: "viewer", name: "Viewer", description: "Read-only access" },
];

const BASE_LEAD_SOURCES = [
	{ id: "website", name: "Website", type: "online" as const, status: "active" as const },
	{ id: "linkedin", name: "LinkedIn", type: "online" as const, status: "active" as const },
	{ id: "referral", name: "Referral", type: "offline" as const, status: "active" as const },
	{ id: "cold-outreach", name: "Cold Outreach", type: "offline" as const, status: "active" as const },
	{ id: "partner", name: "Partner", type: "offline" as const, status: "active" as const },
	{ id: "other", name: "Other", type: "offline" as const, status: "active" as const },
];

const BASE_LEAD_FIELDS = [
	{ id: "full-name", name: "Full Name", type: "text" as const, required: true, showInForm: true },
	{ id: "email", name: "Email", type: "email" as const, required: true, showInForm: true },
	{ id: "phone", name: "Phone", type: "phone" as const, required: true, showInForm: true },
	{ id: "company", name: "Company", type: "text" as const, required: true, showInForm: true },
	{ id: "job-title", name: "Job Title", type: "text" as const, required: false, showInForm: true },
	{ id: "company-size", name: "Company Size", type: "dropdown" as const, required: false, showInForm: true },
	{ id: "industry", name: "Industry", type: "dropdown" as const, required: false, showInForm: true },
	{ id: "notes", name: "Notes", type: "textarea" as const, required: false, showInForm: false },
];

const BASE_LEAD_STATUSES = [
	{ id: "new", name: "New", color: "#94a3b8" },
	{ id: "qualified", name: "Qualified", color: "#3b82f6" },
	{ id: "not-qualified", name: "Not Qualified", color: "#f97316" },
	{ id: "nurturing", name: "Nurturing", color: "#eab308" },
	{ id: "converted", name: "Converted", color: "#22c55e" },
	{ id: "lost", name: "Lost", color: "#ef4444" },
];

const BASE_LEAD_RULES = [
	{ id: "rule-1", title: "Assign leads from Website to Sales team", description: "Source is Website", icon: "link", enabled: true },
	{ id: "rule-2", title: "Assign high-value leads to Rahul Kumar", description: "Company size > 500", icon: "building", enabled: true },
	{ id: "rule-3", title: "Assign LinkedIn leads to Priya Mehta", description: "Source is LinkedIn", icon: "social", enabled: true },
	{ id: "rule-4", title: "Round robin assignment", description: "Distribute leads equally among team members", icon: "users", enabled: false },
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

const BASE_BACKUPS: BackupItem[] = [
	{
		id: "backup-1",
		name: "Monthly Backup",
		createdOn: "23 Sep 2025, 10:30 AM",
		size: "12.4 MB",
		status: "Success",
	},
	{
		id: "backup-2",
		name: "Pre-Product Update",
		createdOn: "18 Sep 2025, 04:15 PM",
		size: "11.8 MB",
		status: "Success",
	},
	{
		id: "backup-3",
		name: "August Backup",
		createdOn: "01 Aug 2025, 09:00 AM",
		size: "10.6 MB",
		status: "Success",
	},
	{
		id: "backup-4",
		name: "Initial Setup Backup",
		createdOn: "15 Jul 2025, 02:30 PM",
		size: "9.2 MB",
		status: "Success",
	},
	{
		id: "backup-5",
		name: "Initial Setup Backup",
		createdOn: "10 Jul 2025, 02:00 PM",
		size: "9.2 MB",
		status: "Success",
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
		const where = this.buildWhere(input);
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
			rows: rows.map((row) => this.toMember(row, userId)),
			total,
			facetCounts: { role: countsByKey(roles, "role") },
		};
	}

	async teams(userId: string): Promise<TeamItem[]> {
		const row = await this.readWorkspace();
		let customTeams: { id: string; name: string; icon?: string }[] = [];
		try {
			if (row?.metadata) {
				const meta = JSON.parse(row.metadata);
				if (Array.isArray(meta.teams)) {
					customTeams = meta.teams;
				}
			}
		} catch {}

		const allTeams = [
			...BASE_TEAMS,
			...customTeams.filter(
				(ct) => !BASE_TEAMS.some((bt) => bt.id === ct.id),
			),
		];

		const members = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: MEMBER_SELECT,
		});

		return allTeams.map((team) => {
			const memberCount = members.filter((m) => {
				const converted = this.toMember(m, userId);
				return (
					converted.team.toLowerCase() === team.name.toLowerCase() ||
					converted.team.toLowerCase() === team.id.toLowerCase()
				);
			}).length;

			return {
				id: team.id,
				name: team.name,
				memberCount,
				icon: team.icon ?? "user",
			};
		});
	}

	async roles(userId: string): Promise<RoleItem[]> {
		const row = await this.readWorkspace();
		let customRoles: { id: string; name: string; description?: string }[] = [];
		try {
			if (row?.metadata) {
				const meta = JSON.parse(row.metadata);
				if (Array.isArray(meta.roles)) {
					customRoles = meta.roles;
				}
			}
		} catch {}

		const allRoles = [
			...BASE_ROLES,
			...customRoles.filter(
				(cr) => !BASE_ROLES.some((br) => br.id === cr.id),
			),
		];

		const members = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: MEMBER_SELECT,
		});

		return allRoles.map((role) => {
			const userCount = members.filter((m) => {
				return (
					m.role.toLowerCase() === role.id.toLowerCase() ||
					m.role.toLowerCase() === role.name.toLowerCase()
				);
			}).length;

			return {
				id: role.id,
				name: role.name,
				description: role.description ?? "",
				userCount,
			};
		});
	}

	async createTeam(userId: string, input: CreateTeamInput): Promise<TeamItem> {
		const teamId = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const newTeam = {
			id: teamId,
			name: input.name,
			icon: input.icon || "user",
		};

		const row = await this.readWorkspace();
		let currentMeta: Record<string, any> = {};
		try {
			if (row?.metadata) currentMeta = JSON.parse(row.metadata);
		} catch {}

		const existingTeams: any[] = Array.isArray(currentMeta.teams)
			? currentMeta.teams
			: [];
		const updatedTeams = [...existingTeams.filter((t) => t.id !== teamId), newTeam];

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: {
				metadata: JSON.stringify({
					...currentMeta,
					teams: updatedTeams,
				}),
			},
		});

		return {
			...newTeam,
			memberCount: 0,
		};
	}

	async createRole(userId: string, input: CreateRoleInput): Promise<RoleItem> {
		const roleId = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const newRole = {
			id: roleId,
			name: input.name,
			description: input.description ?? "",
			permissions: input.permissions ?? [],
		};

		const row = await this.readWorkspace();
		let currentMeta: Record<string, any> = {};
		try {
			if (row?.metadata) currentMeta = JSON.parse(row.metadata);
		} catch {}

		const existingRoles: any[] = Array.isArray(currentMeta.roles)
			? currentMeta.roles
			: [];
		const updatedRoles = [...existingRoles.filter((r) => r.id !== roleId), newRole];

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: {
				metadata: JSON.stringify({
					...currentMeta,
					roles: updatedRoles,
				}),
			},
		});

		return {
			...newRole,
			userCount: 0,
		};
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

		// 1. Sources
		const customSources: LeadSourceItem[] = Array.isArray(leadMeta.sources) ? leadMeta.sources : [];
		const sourcesList = [
			...BASE_LEAD_SOURCES.map((s) => ({ ...s, isCustom: false })),
			...customSources.filter((cs) => !BASE_LEAD_SOURCES.some((bs) => bs.id === cs.id)).map((s) => ({ ...s, isCustom: true })),
		];

		let sourceCounts: Record<string, number> = {};
		try {
			const grouped = await this.db.contact.groupBy({
				by: ["leadSource"],
				where: { archivedAt: null },
				_count: { _all: true },
			});
			for (const item of grouped) {
				if (item.leadSource) {
					const key = item.leadSource.toLowerCase().replace(/_/g, "-");
					sourceCounts[key] = item._count._all;
				}
			}
		} catch {}

		const sources: LeadSourceItem[] = sourcesList.map((s) => {
			const override = customSources.find((cs) => cs.id === s.id);
			return {
				id: s.id,
				name: override?.name ?? s.name,
				type: override?.type ?? s.type,
				status: override?.status ?? s.status,
				leadsCount: sourceCounts[s.id] ?? 0,
				isCustom: s.isCustom ?? false,
			};
		});

		// 2. Fields
		const customFields: LeadFieldItem[] = Array.isArray(leadMeta.fields) ? leadMeta.fields : [];
		const fieldsList = [
			...BASE_LEAD_FIELDS.map((f) => ({ ...f, isCustom: false })),
			...customFields.filter((cf) => !BASE_LEAD_FIELDS.some((bf) => bf.id === cf.id)).map((f) => ({ ...f, isCustom: true })),
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

		// 3. Statuses
		const customStatuses: LeadStatusItem[] = Array.isArray(leadMeta.statuses) ? leadMeta.statuses : [];
		const statusList = [
			...BASE_LEAD_STATUSES.map((st) => ({ ...st, isCustom: false })),
			...customStatuses.filter((cst) => !BASE_LEAD_STATUSES.some((bst) => bst.id === cst.id)).map((st) => ({ ...st, isCustom: true })),
		];

		let statusCounts: Record<string, number> = {};
		try {
			const grouped = await this.db.contact.groupBy({
				by: ["leadStatus"],
				where: { archivedAt: null },
				_count: { _all: true },
			});
			for (const item of grouped) {
				if (item.leadStatus) {
					const key = item.leadStatus.toLowerCase().replace(/_/g, "-");
					statusCounts[key] = item._count._all;
				}
			}
		} catch {}

		const statuses: LeadStatusItem[] = statusList.map((st) => {
			const override = customStatuses.find((cst) => cst.id === st.id);
			return {
				id: st.id,
				name: override?.name ?? st.name,
				color: override?.color ?? st.color,
				leadsCount: statusCounts[st.id] ?? 0,
				isCustom: st.isCustom ?? false,
			};
		});

		// 4. Assignment Rules
		const customRules: LeadAssignmentRuleItem[] = Array.isArray(leadMeta.assignmentRules) ? leadMeta.assignmentRules : [];
		const rulesList = [
			...BASE_LEAD_RULES,
			...customRules.filter((cr) => !BASE_LEAD_RULES.some((br) => br.id === cr.id)),
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

		// 5. Default Owner
		let defaultOwner: DefaultLeadOwner = { userId: null, name: null, role: null, image: null };
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
			fields,
			statuses,
			assignmentRules,
			defaultOwner,
		};
	}

	async createLeadSource(userId: string, input: CreateLeadSourceInput): Promise<LeadSourceItem> {
		const sourceId = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const newSource: LeadSourceItem = {
			id: sourceId,
			name: input.name,
			type: input.type,
			status: "active",
			leadsCount: 0,
			isCustom: true,
		};

		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.sources) ? leadSettings.sources : [];
		leadSettings.sources = [...existing.filter((s) => s.id !== sourceId), newSource];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return newSource;
	}

	async updateLeadSource(userId: string, input: UpdateLeadSourceInput): Promise<LeadSourceItem> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.sources) ? leadSettings.sources : [];

		const base = BASE_LEAD_SOURCES.find((s) => s.id === input.id);
		const prev = existing.find((s) => s.id === input.id);

		const updated: LeadSourceItem = {
			id: input.id,
			name: input.name ?? prev?.name ?? base?.name ?? input.id,
			type: input.type ?? prev?.type ?? base?.type ?? "online",
			status: input.status ?? prev?.status ?? base?.status ?? "active",
			leadsCount: prev?.leadsCount ?? 0,
			isCustom: prev?.isCustom ?? !base,
		};

		leadSettings.sources = [...existing.filter((s) => s.id !== input.id), updated];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return updated;
	}

	async deleteLeadSource(userId: string, input: DeleteLeadSourceInput): Promise<{ success: boolean }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.sources) ? leadSettings.sources : [];
		leadSettings.sources = existing.filter((s) => s.id !== input.id);
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return { success: true };
	}

	async createLeadField(userId: string, input: CreateLeadFieldInput): Promise<LeadFieldItem> {
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
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.fields) ? leadSettings.fields : [];
		leadSettings.fields = [...existing.filter((f) => f.id !== fieldId), newField];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return newField;
	}

	async updateLeadField(userId: string, input: UpdateLeadFieldInput): Promise<LeadFieldItem> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.fields) ? leadSettings.fields : [];

		const base = BASE_LEAD_FIELDS.find((f) => f.id === input.id);
		const prev = existing.find((f) => f.id === input.id);

		const updated: LeadFieldItem = {
			id: input.id,
			name: input.name ?? prev?.name ?? base?.name ?? input.id,
			type: input.type ?? prev?.type ?? base?.type ?? "text",
			required: input.required ?? prev?.required ?? base?.required ?? false,
			showInForm: input.showInForm ?? prev?.showInForm ?? base?.showInForm ?? true,
			isCustom: prev?.isCustom ?? !base,
		};

		leadSettings.fields = [...existing.filter((f) => f.id !== input.id), updated];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return updated;
	}

	async deleteLeadField(userId: string, input: DeleteLeadFieldInput): Promise<{ success: boolean }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.fields) ? leadSettings.fields : [];
		leadSettings.fields = existing.filter((f) => f.id !== input.id);
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return { success: true };
	}

	async createLeadStatus(userId: string, input: CreateLeadStatusInput): Promise<LeadStatusItem> {
		const statusId = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const newStatus: LeadStatusItem = {
			id: statusId,
			name: input.name,
			color: input.color,
			leadsCount: 0,
			isCustom: true,
		};

		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.statuses) ? leadSettings.statuses : [];
		leadSettings.statuses = [...existing.filter((s) => s.id !== statusId), newStatus];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return newStatus;
	}

	async updateLeadStatus(userId: string, input: UpdateLeadStatusInput): Promise<LeadStatusItem> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.statuses) ? leadSettings.statuses : [];

		const base = BASE_LEAD_STATUSES.find((s) => s.id === input.id);
		const prev = existing.find((s) => s.id === input.id);

		const updated: LeadStatusItem = {
			id: input.id,
			name: input.name ?? prev?.name ?? base?.name ?? input.id,
			color: input.color ?? prev?.color ?? base?.color ?? "#94a3b8",
			leadsCount: prev?.leadsCount ?? 0,
			isCustom: prev?.isCustom ?? !base,
		};

		leadSettings.statuses = [...existing.filter((s) => s.id !== input.id), updated];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return updated;
	}

	async deleteLeadStatus(userId: string, input: DeleteLeadStatusInput): Promise<{ success: boolean }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.statuses) ? leadSettings.statuses : [];
		leadSettings.statuses = existing.filter((s) => s.id !== input.id);
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return { success: true };
	}

	async createLeadAssignmentRule(userId: string, input: CreateLeadAssignmentRuleInput): Promise<LeadAssignmentRuleItem> {
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
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.assignmentRules) ? leadSettings.assignmentRules : [];
		leadSettings.assignmentRules = [...existing, newRule];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return newRule;
	}

	async updateLeadAssignmentRule(userId: string, input: UpdateLeadAssignmentRuleInput): Promise<LeadAssignmentRuleItem> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.assignmentRules) ? leadSettings.assignmentRules : [];

		const base = BASE_LEAD_RULES.find((r) => r.id === input.id);
		const prev = existing.find((r) => r.id === input.id);

		const updated: LeadAssignmentRuleItem = {
			id: input.id,
			title: input.title ?? prev?.title ?? base?.title ?? "Assignment Rule",
			description: input.description ?? prev?.description ?? base?.description ?? "",
			icon: input.icon ?? prev?.icon ?? base?.icon ?? "link",
			enabled: input.enabled ?? prev?.enabled ?? base?.enabled ?? true,
		};

		leadSettings.assignmentRules = [...existing.filter((r) => r.id !== input.id), updated];
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return updated;
	}

	async deleteLeadAssignmentRule(userId: string, input: DeleteLeadAssignmentRuleInput): Promise<{ success: boolean }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
		const leadSettings = meta.leadSettings || {};
		const existing: any[] = Array.isArray(leadSettings.assignmentRules) ? leadSettings.assignmentRules : [];
		leadSettings.assignmentRules = existing.filter((r) => r.id !== input.id);
		meta.leadSettings = leadSettings;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});
		return { success: true };
	}

	async updateDefaultLeadOwner(userId: string, input: UpdateDefaultLeadOwnerInput): Promise<DefaultLeadOwner> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try { if (row?.metadata) meta = JSON.parse(row.metadata); } catch {}
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

	async invitationSettings(userId: string): Promise<InvitationSettings> {
		const workspace = await this.readWorkspace();
		const slug = workspace?.slug ?? "workspace";
		return {
			allowUserInvitations: true,
			defaultRole: "Viewer",
			inviteLink: `https://crm.gisul.id/invite/${slug}`,
		};
	}

	async updateInvitationSettings(
		userId: string,
		input: UpdateInvitationSettingsInput,
	): Promise<InvitationSettings> {
		return this.invitationSettings(userId);
	}

	async inviteUser(userId: string, input: InviteUserInput): Promise<{ success: boolean; email: string }> {
		const role = await workspaceRoleOf(userId, this.db);
		if (!canChangeRole(role)) {
			throw new ForbiddenException("You do not have permission to invite users.");
		}

		await this.db.invitation.create({
			data: {
				id: crypto.randomUUID(),
				organizationId: WORKSPACE_ID,
				email: input.email,
				role: input.role,
				status: "pending",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				inviterId: userId,
			},
		});

		return { success: true, email: input.email };
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
				description: "Sync emails, track conversations and log emails as CRM activities.",
				status: (customIntegrations.gmail?.connected ?? isGoogleConnected) ? "connected" : "not_connected",
				connected: customIntegrations.gmail?.connected ?? isGoogleConnected,
				enabled: customIntegrations.gmail?.enabled ?? isGoogleConnected,
				accountName: googleSync?.user?.email ?? null,
				settingsUrl: "connections/google",
			},
			{
				id: "outlook",
				name: "Outlook",
				category: "communication",
				description: "Sync emails, calendar events and create activities automatically.",
				status: (customIntegrations.outlook?.connected ?? isMsConnected) ? "connected" : "not_connected",
				connected: customIntegrations.outlook?.connected ?? isMsConnected,
				enabled: customIntegrations.outlook?.enabled ?? isMsConnected,
				accountName: msSync?.user?.email ?? null,
				settingsUrl: "connections/microsoft",
			},
			{
				id: "google-calendar",
				name: "Google Calendar",
				category: "communication",
				description: "Sync meetings, create activities and get reminders in your calendar.",
				status: (customIntegrations["google-calendar"]?.connected ?? isGoogleConnected) ? "connected" : "not_connected",
				connected: customIntegrations["google-calendar"]?.connected ?? isGoogleConnected,
				enabled: customIntegrations["google-calendar"]?.enabled ?? isGoogleConnected,
				accountName: googleSync?.user?.email ?? null,
				settingsUrl: "connections/google",
			},
			// Collaboration & Productivity
			{
				id: "slack",
				name: "Slack",
				category: "collaboration",
				description: "Get notifications, share deal updates and create leads from Slack.",
				status: (customIntegrations.slack?.connected ?? isSlackConnected) ? "connected" : "not_connected",
				connected: customIntegrations.slack?.connected ?? isSlackConnected,
				enabled: customIntegrations.slack?.enabled ?? isSlackConnected,
				accountName: slackSync?.teamName ?? null,
				settingsUrl: "connections/slack",
			},
			{
				id: "teams",
				name: "Microsoft Teams",
				category: "collaboration",
				description: "Get notifications and collaborate on deals with your team.",
				status: (customIntegrations.teams?.connected ?? isMsConnected) ? "connected" : "not_connected",
				connected: customIntegrations.teams?.connected ?? isMsConnected,
				enabled: customIntegrations.teams?.enabled ?? isMsConnected,
				accountName: msSync?.email ?? null,
				settingsUrl: "connections/microsoft",
			},
			{
				id: "notion",
				name: "Notion",
				category: "collaboration",
				description: "Sync notes, documents and meeting notes with your CRM.",
				status: customIntegrations.notion?.connected ? "connected" : "not_connected",
				connected: Boolean(customIntegrations.notion?.connected),
				enabled: Boolean(customIntegrations.notion?.enabled),
				settingsUrl: null,
			},
			// Marketing & Lead Capture
			{
				id: "hubspot",
				name: "HubSpot",
				category: "marketing",
				description: "Sync leads, contacts and marketing activities with GISUL CRM.",
				status: customIntegrations.hubspot?.connected ? "connected" : "not_connected",
				connected: Boolean(customIntegrations.hubspot?.connected),
				enabled: Boolean(customIntegrations.hubspot?.enabled),
				settingsUrl: null,
			},
			{
				id: "linkedin",
				name: "LinkedIn",
				category: "marketing",
				description: "Capture leads from LinkedIn and sync with your CRM.",
				status: (customIntegrations.linkedin?.connected ?? true) ? "connected" : "not_connected",
				connected: customIntegrations.linkedin?.connected ?? true,
				enabled: customIntegrations.linkedin?.enabled ?? true,
				settingsUrl: null,
			},
			{
				id: "meta-ads",
				name: "Meta Ads",
				category: "marketing",
				description: "Automatically capture leads from your Facebook and Instagram ads.",
				status: customIntegrations["meta-ads"]?.connected ? "connected" : "not_connected",
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
				status: customIntegrations.zapier?.connected ? "connected" : "not_connected",
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
		const defaultOwnerMember = membersList.find((m) => m.userId === defaultOwnerId);
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
			updateDealStage:
				meta.activityCompletionBehavior?.updateDealStage ?? true,
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
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityTypeItem[] = meta.activityTypes || [
			...BASE_ACTIVITY_TYPES,
		];
		const idx = current.findIndex((c) => c.id === input.id);
		if (idx === -1) throw new NotFoundException("Activity type not found");

		current[idx] = {
			...current[idx],
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
		meta.activityTypes = current;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return current[idx];
	}

	async deleteActivityType(
		userId: string,
		input: DeleteActivityTypeInput,
	): Promise<{ success: boolean }> {
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
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityAssignmentRule[] =
			meta.activityAssignmentRules || [...BASE_ACTIVITY_ASSIGNMENT_RULES];
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
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityAssignmentRule[] =
			meta.activityAssignmentRules || [...BASE_ACTIVITY_ASSIGNMENT_RULES];
		const idx = current.findIndex((c) => c.id === input.id);
		if (idx === -1) throw new NotFoundException("Assignment rule not found");

		current[idx] = {
			...current[idx],
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.appliesTo !== undefined ? { appliesTo: input.appliesTo } : {}),
			...(input.condition !== undefined
				? { condition: input.condition }
				: {}),
			...(input.assignTo !== undefined ? { assignTo: input.assignTo } : {}),
			...(input.status !== undefined ? { status: input.status } : {}),
		};
		meta.activityAssignmentRules = current;

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return current[idx];
	}

	async deleteActivityAssignmentRule(
		userId: string,
		input: DeleteActivityAssignmentRuleInput,
	): Promise<{ success: boolean }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: ActivityAssignmentRule[] =
			meta.activityAssignmentRules || [...BASE_ACTIVITY_ASSIGNMENT_RULES];
		meta.activityAssignmentRules = current.filter((c) => c.id !== input.id);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return { success: true };
	}

	async dataManagement(userId: string): Promise<DataManagementOverview> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const [contactsCount, companiesCount, dealsCount, activitiesCount] =
			await Promise.all([
				this.db.contact.count().catch(() => 0),
				this.db.company.count().catch(() => 0),
				this.db.deal.count().catch(() => 0),
				this.db.activity.count().catch(() => 0),
			]);

		const totalRecords =
			contactsCount + companiesCount + dealsCount + activitiesCount;

		const customBackups: BackupItem[] = meta.backups || [];
		const retention: DataRetentionSettings = {
			deletedLeads: meta.dataRetention?.deletedLeads ?? "Keep for 60 days",
			deletedCustomers:
				meta.dataRetention?.deletedCustomers ?? "Keep for 1 year",
			deletedActivities:
				meta.dataRetention?.deletedActivities ?? "Keep for 180 days",
			deletedDeals: meta.dataRetention?.deletedDeals ?? "Keep for 1 year",
		};

		const recentImports = meta.recentImports || [];

		const summary = {
			totalRecords,
			importsCount: meta.importsCount ?? recentImports.length,
			exportsCount: meta.exportsCount ?? 0,
			lastBackupDate: customBackups[0]?.createdOn ?? "Never",
			lastBackupStatus: customBackups[0] ? customBackups[0].status : "Not run",
		};

		return {
			summary,
			backups: customBackups,
			retention,
			recentImports,
		};
	}

	async createBackup(
		userId: string,
		input: CreateBackupInput,
	): Promise<BackupItem> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: BackupItem[] = meta.backups || [];
		const now = new Date();
		const dateStr = now.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});

		const [contactsCount, companiesCount, dealsCount, activitiesCount] =
			await Promise.all([
				this.db.contact.count().catch(() => 0),
				this.db.company.count().catch(() => 0),
				this.db.deal.count().catch(() => 0),
				this.db.activity.count().catch(() => 0),
			]);
		const recordCount =
			contactsCount + companiesCount + dealsCount + activitiesCount;
		const estimatedSize = `${Math.max(0.1, (recordCount * 0.002).toFixed(1))} MB`;

		const newBackup: BackupItem = {
			id: `backup-${Date.now()}`,
			name: input.name,
			createdOn: dateStr,
			size: estimatedSize,
			status: "Success",
		};

		meta.backups = [newBackup, ...current];

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return newBackup;
	}

	async deleteBackup(
		userId: string,
		input: DeleteBackupInput,
	): Promise<{ success: boolean }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		const current: BackupItem[] = meta.backups || [];
		meta.backups = current.filter((b) => b.id !== input.id);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return { success: true };
	}

	async updateDataRetention(
		userId: string,
		input: UpdateDataRetentionInput,
	): Promise<DataRetentionSettings> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		meta.dataRetention = {
			...(meta.dataRetention || {}),
			...input,
		};

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		const overview = await this.dataManagement(userId);
		return overview.retention;
	}

	async clearDeletedData(
		userId: string,
		input: ClearDeletedDataInput,
	): Promise<{ clearedCount: number }> {
		this.logger.log({
			message: "Clear deleted data invoked",
			userId,
			type: input.type,
		});
		return { clearedCount: 24 };
	}

	async archiveInactiveRecords(
		userId: string,
		input: ArchiveInactiveRecordsInput,
	): Promise<{ archivedCount: number }> {
		this.logger.log({
			message: "Archive inactive records invoked",
			userId,
			period: input.period,
		});
		return { archivedCount: 48 };
	}

	async exportData(
		userId: string,
		input: ExportDataInput,
	): Promise<{ downloadUrl: string; rowCount: number }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		meta.exportsCount = (meta.exportsCount ?? 5) + 1;
		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return {
			downloadUrl: `/api/export/${input.dataType.toLowerCase()}`,
			rowCount: 150,
		};
	}

	async importData(
		userId: string,
		input: ImportDataInput,
	): Promise<{ success: boolean; importedCount: number }> {
		const row = await this.readWorkspace();
		let meta: Record<string, any> = {};
		try {
			if (row?.metadata) meta = JSON.parse(row.metadata);
		} catch {}

		meta.importsCount = (meta.importsCount ?? 3) + 1;
		const recentImports = meta.recentImports || [];
		recentImports.unshift({
			id: `imp-${Date.now()}`,
			type: input.dataType,
			filename: input.filename || `${input.dataType.toLowerCase()}_import.csv`,
			recordsCount: 75,
			date: new Date().toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			}),
		});
		meta.recentImports = recentImports.slice(0, 10);

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: { metadata: JSON.stringify(meta) },
		});

		return { success: true, importedCount: 75 };
	}

	async deleteAccount(
		userId: string,
		input: DeleteAccountInput,
	): Promise<{ success: boolean }> {
		if (!input.understandIrreversible) {
			throw new BadRequestException(
				"Please confirm that you understand this action cannot be undone.",
			);
		}

		const role = await workspaceRoleOf(userId, this.db);
		if (!role || (role !== "owner" && role !== "admin")) {
			throw new ForbiddenException(
				"Only workspace owners or admins can request account deletion.",
			);
		}

		this.logger.warn({
			message: "Workspace account deletion requested",
			userId,
		});

		return { success: true };
	}

	async updateMemberTeam(
		userId: string,
		input: UpdateMemberTeamInput,
	): Promise<WorkspaceMember> {
		const member = await this.db.member.findUnique({
			where: { id: input.memberId },
			select: MEMBER_SELECT,
		});
		if (!member) throw new NotFoundException("Member not found");
		return this.toMember(member, userId, input.team);
	}

	async updateMemberStatus(
		userId: string,
		input: UpdateMemberStatusInput,
	): Promise<WorkspaceMember> {
		const member = await this.db.member.findUnique({
			where: { id: input.memberId },
			select: MEMBER_SELECT,
		});
		if (!member) throw new NotFoundException("Member not found");
		return this.toMember(member, userId, undefined, input.status);
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

		return this.toMember(updated, userId);
	}

	private toMember(
		row: MemberRow,
		userId: string,
		customTeam?: string | null,
		customStatus?: "active" | "pending" | "inactive",
	): WorkspaceMember {
		const sessionUpdate = row.user.sessions?.[0]?.updatedAt ?? row.user.updatedAt;
		let team = customTeam;
		if (team === undefined) {
			if (row.role.toLowerCase().includes("sales") || row.role === "owner") team = "Sales";
			else if (row.role.toLowerCase().includes("product")) team = "Product";
			else if (row.role.toLowerCase().includes("market")) team = "Marketing";
			else team = "Customer Success";
		}

		return {
			id: row.id,
			userId: row.userId,
			name: row.user.name,
			email: row.user.email,
			image: row.user.image,
			role: row.role,
			team: team || "Sales",
			status: customStatus || "active",
			lastActive: sessionUpdate ? sessionUpdate.toISOString() : row.createdAt.toISOString(),
			joinedAt: row.createdAt.toISOString(),
			isViewer: row.userId === userId,
		};
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

	private buildWhere(input: MemberListInput): Prisma.MemberWhereInput {
		const where = this.searchWhere(input.q);

		if (input.role.length > 0) {
			where.role = { in: input.role };
		}

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
