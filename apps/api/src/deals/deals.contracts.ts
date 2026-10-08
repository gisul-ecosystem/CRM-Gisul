import { DealStage } from "@crm/db";
import { FIELD_ENTITIES, FIELD_TYPES } from "@crm/db/fields";
import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import { currencyCode } from "../currency/currency.contracts";
import { recordFieldValues } from "../fields/fields.contracts";
import { listInput } from "../trpc/list-input";

export const MAX_AMOUNT_CENTS = 99_999_999_999_999;

const amountCents = z
	.number()
	.int()
	.min(0)
	.max(MAX_AMOUNT_CENTS, "That amount is too large to record.")
	.nullable()
	.optional();

export const CLOSING_WINDOWS = [
	"overdue",
	"this-month",
	"next-month",
	"later",
	"none",
] as const;

export type ClosingWindow = (typeof CLOSING_WINDOWS)[number];

export const dealListInput = listInput.extend({
	status: z.string().default("all"),
	owner: z.array(z.string()).default([]),
	company: z.array(z.string()).default([]),
	stage: z.array(z.string()).default([]),
	product: z.array(z.string()).default([]),
	closing: z.array(z.string()).default([]),
	fields: z.record(z.string(), z.array(z.string())).default({}),
	archived: z.boolean().default(false),
});

export type DealListInput = z.infer<typeof dealListInput>;

const stageEnum = z.enum(
	Object.values(DealStage) as [DealStage, ...DealStage[]],
);

export const dealCreateInput = z.object({
	name: z.string().trim().min(1, "A deal needs a name."),
	companyId: z.string().min(1, "A deal belongs to a company."),
	ownerId: z.string().min(1, "A deal needs an owner."),
	productId: z.string().nullable().optional(),
	stage: stageEnum.optional(),
	amountCents,
	currency: currencyCode.optional(),
	expectedCloseDate: z.string().nullable().optional(),
});

export type DealCreateInput = z.infer<typeof dealCreateInput>;

const dealUpdateInput = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().nullable().optional(),
	companyId: z.string().optional(),
	ownerId: z.string().optional(),
	productId: z.string().nullable().optional(),
	amountCents,
	currency: currencyCode.optional(),
	expectedCloseDate: z.string().nullable().optional(),
	fields: recordFieldValues.optional(),
});

export type DealUpdateInput = z.infer<typeof dealUpdateInput>;

export const dealUpdateArgs = z.object({
	id: z.string(),
	data: dealUpdateInput,
});

export const dealIdInput = z.object({ id: z.string() });

export const setStageInput = z.object({
	id: z.string(),
	stage: stageEnum,
	closedReason: z.string().trim().optional(),
});

export type SetStageInput = z.infer<typeof setStageInput>;

const dealContactRole = z
	.string()
	.trim()
	.max(80, "That role is too long.")
	.nullable();

export const dealContactsInput = z.object({ dealId: z.string() });

export const dealAttachContactInput = z.object({
	dealId: z.string(),
	contactId: z.string().min(1, "Choose somebody to bring onto the deal."),
	role: dealContactRole.optional(),
});

export type DealAttachContactInput = z.infer<typeof dealAttachContactInput>;

export const dealDetachContactInput = z.object({
	dealId: z.string(),
	contactId: z.string(),
});

export type DealDetachContactInput = z.infer<typeof dealDetachContactInput>;

export const dealContactRoleInput = z.object({
	dealId: z.string(),
	contactId: z.string(),
	role: dealContactRole,
});

export type DealContactRoleInput = z.infer<typeof dealContactRoleInput>;

export const dealBulkInput = bulkIdsInput;

export const dealBulkOwnerInput = bulkIdsInput.extend({
	ownerId: z.string().min(1, "A deal needs an owner."),
});

export type DealBulkOwnerInput = z.infer<typeof dealBulkOwnerInput>;

export const dealBulkStageInput = bulkIdsInput.extend({
	stage: stageEnum,
	closedReason: z.string().trim().optional(),
});

export type DealBulkStageInput = z.infer<typeof dealBulkStageInput>;

const fieldValueOutput = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.null(),
]);

const fieldOptionOutput = z.object({
	id: z.string(),
	label: z.string(),
	position: z.number(),
});

const recordFieldOutput = z.object({
	id: z.string(),
	entity: z.enum(FIELD_ENTITIES),
	key: z.string(),
	label: z.string(),
	type: z.enum(FIELD_TYPES),
	typeLabel: z.string(),
	agentFilled: z.boolean(),
	agentBrief: z.string().nullable(),
	required: z.boolean(),
	showOnSheet: z.boolean(),
	showOnTable: z.boolean(),
	showOnFilter: z.boolean(),
	position: z.number(),
	archived: z.boolean(),
	options: z.array(fieldOptionOutput),
	value: fieldValueOutput,
});

const dealOwnerOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

const dealCompanyOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
	logoUrl: z.string().nullable(),
});

const dealCompanyDetailOutput = dealCompanyOutput.extend({
	industry: z.string().nullable(),
});

const dealContactSummaryOutput = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string().nullable(),
	email: z.string().nullable(),
	title: z.string().nullable(),
	imageUrl: z.string().nullable(),
});

const dealContactOutput = dealContactSummaryOutput.extend({
	role: z.string().nullable(),
});

const dealProductOutput = z.object({
	id: z.string(),
	name: z.string(),
	color: z.string(),
});

const dealListRowOutput = z.object({
	id: z.string(),
	name: z.string(),
	stage: stageEnum,
	currency: z.string(),
	company: dealCompanyOutput,
	owner: dealOwnerOutput,
	product: dealProductOutput.nullable(),
	amountCents: z.number().nullable(),
	baseAmountCents: z.number().nullable(),
	expectedCloseDate: z.string().nullable(),
	closedAt: z.string().nullable(),
	lastActivityAt: z.string().nullable(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
	fields: z.record(z.string(), fieldValueOutput),
});

export const dealListOutput = z.object({
	rows: z.array(dealListRowOutput),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
	openValueCents: z.number().nullable(),
	reportingCurrency: z.string(),
	unconverted: z.object({
		count: z.number(),
		currencies: z.array(z.string()),
	}),
});

export type DealListResult = z.infer<typeof dealListOutput>;

export const dealDetailOutput = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	stage: stageEnum,
	currency: z.string(),
	closedReason: z.string().nullable(),
	company: dealCompanyDetailOutput,
	owner: dealOwnerOutput,
	fields: z.array(recordFieldOutput),
	amountCents: z.number().nullable(),
	baseAmountCents: z.number().nullable(),
	reportingCurrency: z.string(),
	fxRate: z.number().nullable(),
	fxRateAt: z.string().nullable(),
	stageChangedAt: z.string(),
	expectedCloseDate: z.string().nullable(),
	closedAt: z.string().nullable(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
	contacts: z.array(dealContactOutput),
});

export type DealDetail = z.infer<typeof dealDetailOutput>;

export const dealCreateOutput = z.object({
	id: z.string(),
	name: z.string(),
	companyId: z.string(),
});

export type DealCreated = z.infer<typeof dealCreateOutput>;

export const dealMutateOutput = z.object({
	id: z.string(),
	name: z.string(),
});

export type DealMutated = z.infer<typeof dealMutateOutput>;

export const dealSetStageOutput = z.object({
	id: z.string(),
	stage: stageEnum,
	changed: z.boolean(),
});

export type DealSetStageResult = z.infer<typeof dealSetStageOutput>;

export const dealContactOptionsOutput = z.array(dealContactSummaryOutput);

export type DealContactOption = z.infer<typeof dealContactSummaryOutput>;

export const dealContactLinkOutput = z.object({
	dealId: z.string(),
	contactId: z.string(),
});

export type DealContactLink = z.infer<typeof dealContactLinkOutput>;

export const dealContactRoleOutput = z.object({
	dealId: z.string(),
	contactId: z.string(),
	role: z.string().nullable(),
});

export type DealContactRoleResult = z.infer<typeof dealContactRoleOutput>;

export const dealBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export type DealBulkResult = z.infer<typeof dealBulkResultOutput>;

export const dealTrendPointOutput = z.object({
	month: z.string(),
	yearMonth: z.string(),
	created: z.number(),
	won: z.number(),
});

export const dealTrendOutput = z.object({
	points: z.array(dealTrendPointOutput),
});

export type DealTrendOutput = z.infer<typeof dealTrendOutput>;

export const dealPipelineProductOutput = z.object({
	id: z.string().nullable(),
	name: z.string(),
	color: z.string(),
	deals: z.number(),
	pipelineCents: z.number(),
});

export const dealPipelineByProductOutput = z.object({
	reportingCurrency: z.string(),
	products: z.array(dealPipelineProductOutput),
});

export type DealPipelineByProductOutput = z.infer<
	typeof dealPipelineByProductOutput
>;

export const dealStageCatalogOutput = z.object({
	stages: z.array(
		z.object({
			stage: stageEnum,
			label: z.string(),
			kind: z.enum(["open", "won", "lost"]),
		}),
	),
});

export type DealStageCatalogOutput = z.infer<typeof dealStageCatalogOutput>;

export const dealExportInput = dealListInput;

export type DealExportInput = z.infer<typeof dealExportInput>;

export const dealExportOutput = z.object({
	csv: z.string(),
	filename: z.string(),
	rowCount: z.number(),
});

export const dealImportInput = z.object({
	csv: z.string().min(1, "Paste or upload a CSV."),
});

export type DealImportInput = z.infer<typeof dealImportInput>;

export const dealImportOutput = z.object({
	created: z.number(),
	updated: z.number(),
	failed: z.number(),
	errors: z.array(
		z.object({
			line: z.number(),
			message: z.string(),
		}),
	),
});

export const dealImportTemplateOutput = z.object({
	csv: z.string(),
	filename: z.string(),
});

export const pipelineStageItemOutput = z.object({
	id: z.string(),
	stage: z.string(),
	name: z.string(),
	probability: z.number(),
	color: z.string(),
	kind: z.enum(["open", "won", "lost"]),
	status: z.enum(["active", "won", "lost", "inactive"]),
	position: z.number(),
	dealCount: z.number(),
	totalValueCents: z.number(),
});

export type PipelineStageItemOutput = z.infer<typeof pipelineStageItemOutput>;

export const pipelineStatsOutput = z.object({
	totalStages: z.number(),
	activeStages: z.number(),
	closedWon: z.number(),
	closedLost: z.number(),
});

export const pipelineSettingsOutput = z.object({
	enableProbabilityTracking: z.boolean(),
	requireStageUpdateNotes: z.boolean(),
	autoAssignDeals: z.boolean(),
	defaultStage: z.string(),
	applyToAllProducts: z.boolean(),
	allowSkippingStages: z.boolean(),
});

export type PipelineSettingsOutput = z.infer<typeof pipelineSettingsOutput>;

export const pipelineOverviewOutput = z.object({
	stages: z.array(pipelineStageItemOutput),
	stats: pipelineStatsOutput,
	currency: z.string(),
	settings: pipelineSettingsOutput,
	canManage: z.boolean(),
});

export type PipelineOverviewOutput = z.infer<typeof pipelineOverviewOutput>;

export const updatePipelineSettingsInput = z.object({
	enableProbabilityTracking: z.boolean().optional(),
	requireStageUpdateNotes: z.boolean().optional(),
	autoAssignDeals: z.boolean().optional(),
	defaultStage: z.string().optional(),
	applyToAllProducts: z.boolean().optional(),
	allowSkippingStages: z.boolean().optional(),
});

export type UpdatePipelineSettingsInput = z.infer<
	typeof updatePipelineSettingsInput
>;

export const createPipelineStageInput = z.object({
	name: z.string().trim().min(1, "Stage name is required"),
	probability: z.number().min(0).max(100),
	color: z.string().min(1),
	kind: z.enum(["open", "won", "lost"]).default("open"),
	status: z.enum(["active", "won", "lost", "inactive"]).default("active"),
});

export type CreatePipelineStageInput = z.infer<
	typeof createPipelineStageInput
>;

export const updatePipelineStageInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).optional(),
	probability: z.number().min(0).max(100).optional(),
	color: z.string().optional(),
	status: z.enum(["active", "won", "lost", "inactive"]).optional(),
	position: z.number().optional(),
});

export type UpdatePipelineStageInput = z.infer<
	typeof updatePipelineStageInput
>;
