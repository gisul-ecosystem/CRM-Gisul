import {
	ActivityType,
	type Db,
	DealStage,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@crm/db";
import { isCurrencyCode, normalizeCurrency } from "@crm/db/currency";
import {
	CLOSED_DEAL_STAGES,
	DEAL_STAGE_CATALOG,
	isClosedStage,
	LOSING_DEAL_STAGES,
	OPEN_DEAL_STAGES,
} from "@crm/db/deal-stage";
import type { FieldDefinitionWithOptions } from "@crm/db/fields";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { ARCHIVE } from "../archive/archive-config";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, requireOwner, runBulk } from "../crm/bulk";
import {
	blankToNull,
	decimalFromCents,
	fromCents,
	normalizeEmail,
	toCents,
} from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import {
	archivedFilter,
	countsByKey,
	FACET_UNASSIGNED,
	type ListResult,
	type OrderByColumns,
	ownerFilter,
	paginate,
	resolveOrderBy,
	splitSentinel,
} from "../trpc/list-input";
import { DEALS } from "./deals-config";
import {
	dealCsvTemplate,
	formatAmount,
	formatDealStage,
	parseAmountCents,
	parseDealCsv,
	parseDealStage,
	serializeDealCsv,
} from "./deals-csv";
import { DEAL_IO } from "./deals-io-config";
import type {
	ClosingWindow,
	DealAttachContactInput,
	DealBulkOwnerInput,
	DealBulkStageInput,
	DealContactRoleInput,
	DealCreateInput,
	DealDetachContactInput,
	DealExportInput,
	DealImportInput,
	DealListInput,
	DealPipelineByProductOutput,
	DealStageCatalogOutput,
	DealTrendOutput,
	DealUpdateInput,
	SetStageInput,
} from "./deals.contracts";
import { CLOSING_WINDOWS } from "./deals.contracts";

const NO_PRODUCT_COLOR = "#9aa0b4";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth() + offset, 1);
}

function yearMonthKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${date.getFullYear()}-${month}`;
}

function monthIndex(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const COMPANY_SELECT = {
	id: true,
	name: true,
	domain: true,
	iconUrl: true,
	iconDarkUrl: true,
	iconTone: true,
	logoUrl: true,
} as const;

const CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	title: true,
	imageUrl: true,
} as const;

const LOSING = new Set<DealStage>(LOSING_DEAL_STAGES);

const PRODUCT_SELECT = {
	id: true,
	name: true,
	color: true,
} as const;

const NO_PRODUCT = "none";

const SORTABLE: OrderByColumns<Prisma.DealOrderByWithRelationInput[]> = {
	name: (dir) => [{ name: dir }],
	company: (dir) => [{ company: { name: dir } }, { name: "asc" }],
	stage: (dir) => [{ stage: dir }, { expectedCloseDate: "asc" }],
	amount: (dir) => [{ baseAmount: { sort: dir, nulls: "last" } }],
	expectedCloseDate: (dir) => [{ expectedCloseDate: dir }],
	createdAt: (dir) => [{ createdAt: dir }],
	owner: (dir) => [{ owner: { name: dir } }, { name: "asc" }],
	product: (dir) => [{ product: { name: dir } }, { name: "asc" }],
	lastActivity: (dir) => [{ lastActivityAt: { sort: dir, nulls: "last" } }],
	archivedAt: (dir) => [{ archivedAt: { sort: dir, nulls: "last" } }],
};

@Injectable()
export class DealsService {
	private readonly logger = new Logger(DealsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
	) {}

	stages(): DealStageCatalogOutput {
		return {
			stages: DEAL_STAGE_CATALOG.map((entry) => ({
				stage: entry.stage,
				label: entry.label,
				kind: entry.kind,
			})),
		};
	}

	async trend(): Promise<DealTrendOutput> {
		const now = new Date();
		const months = DEALS.trend.months;
		const start = monthStart(now, -(months - 1));
		const firstIndex = monthIndex(start);

		const points = Array.from({ length: months }, (_, offset) => {
			const date = monthStart(start, offset);
			return {
				month: MONTH_LABEL.format(date),
				yearMonth: yearMonthKey(date),
				created: 0,
				won: 0,
			};
		});

		const deals = await this.db.deal.findMany({
			where: {
				archivedAt: null,
				OR: [
					{ createdAt: { gte: start } },
					{
						closedAt: { gte: start },
						stage: DealStage.CLOSED_WON,
					},
				],
			},
			select: {
				createdAt: true,
				closedAt: true,
				stage: true,
			},
		});

		for (const deal of deals) {
			const createdBucket = points[monthIndex(deal.createdAt) - firstIndex];
			if (createdBucket) createdBucket.created += 1;

			if (
				deal.closedAt &&
				deal.stage === DealStage.CLOSED_WON &&
				deal.closedAt >= start
			) {
				const wonBucket = points[monthIndex(deal.closedAt) - firstIndex];
				if (wonBucket) wonBucket.won += 1;
			}
		}

		return { points };
	}

	async pipelineByProduct(): Promise<DealPipelineByProductOutput> {
		const base = await this.conversion.reportingCurrency();
		const counted = this.conversion.countedWhere(base);
		const openStage = { stage: { in: [...OPEN_DEAL_STAGES] }, archivedAt: null };

		const [products, openCounts, openValues] = await Promise.all([
			this.db.product.findMany({
				where: { archivedAt: null },
				orderBy: [{ position: "asc" }, { name: "asc" }],
				select: { id: true, name: true, color: true },
			}),
			this.db.deal.groupBy({
				by: ["productId"],
				where: openStage,
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["productId"],
				where: { AND: [openStage, counted] },
				_sum: { baseAmount: true },
			}),
		]);

		const countByProduct = new Map(
			openCounts.map((row) => [row.productId, row._count._all] as const),
		);
		const valueByProduct = new Map(
			openValues.map(
				(row) =>
					[row.productId, toCents(row._sum.baseAmount ?? null) ?? 0] as const,
			),
		);

		const rows = products.map((product) => ({
			id: product.id,
			name: product.name,
			color: product.color,
			deals: countByProduct.get(product.id) ?? 0,
			pipelineCents: valueByProduct.get(product.id) ?? 0,
		}));

		const unassignedDeals = countByProduct.get(null) ?? 0;
		const unassignedCents = valueByProduct.get(null) ?? 0;
		if (unassignedDeals > 0 || unassignedCents > 0) {
			rows.push({
				id: null,
				name: "No product",
				color: NO_PRODUCT_COLOR,
				deals: unassignedDeals,
				pipelineCents: unassignedCents,
			});
		}

		rows.sort((a, b) => b.pipelineCents - a.pipelineCents || b.deals - a.deals);

		const withPipeline = rows.filter(
			(row) => row.deals > 0 || row.pipelineCents > 0,
		);

		return {
			reportingCurrency: base,
			products: withPipeline.length > 0 ? withPipeline : rows,
		};
	}

	async list(input: DealListInput) {
		const filterableFields = await this.fields.filterableFieldsFor("DEAL");
		const where = this.buildWhere(input, filterableFields);
		const { skip, take } = paginate(input);

		const openWhere = { ...where, stage: { in: [...OPEN_DEAL_STAGES] } };
		const base = await this.conversion.reportingCurrency();

		const [rows, total, facetCounts, openValue, unconverted] =
			await Promise.all([
				this.db.deal.findMany({
					where,
					skip,
					take,
					orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
					select: {
						id: true,
						name: true,
						stage: true,
						amount: true,
						currency: true,
						baseAmount: true,
						expectedCloseDate: true,
						closedAt: true,
						company: { select: COMPANY_SELECT },
						owner: { select: OWNER_SELECT },
						product: { select: PRODUCT_SELECT },
						lastActivityAt: true,
						createdAt: true,
						archivedAt: true,
					},
				}),
				this.db.deal.count({ where }),
				this.facetCounts(input, filterableFields),
				this.db.deal.aggregate({
					where: { AND: [openWhere, this.conversion.countedWhere(base)] },
					_sum: { baseAmount: true },
				}),
				this.conversion.unconverted(openWhere),
			]);

		const tableFields = await this.fields.tableValuesFor(
			"DEAL",
			rows.map((row) => row.id),
		);

		return {
			rows: rows.map(
				({
					amount,
					baseAmount,
					expectedCloseDate,
					closedAt,
					lastActivityAt,
					createdAt,
					archivedAt,
					...row
				}) => ({
					...row,
					amountCents: toCents(amount),
					baseAmountCents: toCents(baseAmount),
					expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
					closedAt: closedAt?.toISOString() ?? null,
					lastActivityAt: lastActivityAt?.toISOString() ?? null,
					createdAt: createdAt.toISOString(),
					archivedAt: archivedAt?.toISOString() ?? null,
					fields: tableFields.get(row.id) ?? {},
				}),
			),
			total,
			facetCounts,
			openValueCents: toCents(openValue._sum.baseAmount),
			reportingCurrency: base,
			unconverted,
		} satisfies ListResult<unknown> & {
			openValueCents: number | null;
			reportingCurrency: string;
			unconverted: { count: number; currencies: string[] };
		};
	}

	async exportCsv(input: DealExportInput) {
		const filterableFields = await this.fields.filterableFieldsFor("DEAL");
		const where = this.buildWhere(input, filterableFields);

		const total = await this.db.deal.count({ where });
		if (total > DEAL_IO.export.maxRows) {
			throw new BadRequestException(
				`Export is capped at ${DEAL_IO.export.maxRows} deals. Narrow the filters first.`,
			);
		}

		const rows = await this.db.deal.findMany({
			where,
			orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
			take: DEAL_IO.export.maxRows,
			select: {
				name: true,
				stage: true,
				amount: true,
				currency: true,
				expectedCloseDate: true,
				closedReason: true,
				company: { select: { name: true } },
				owner: { select: { email: true } },
				product: { select: { name: true } },
			},
		});

		const csv = serializeDealCsv(
			rows.map((row) => ({
				name: row.name,
				company: row.company?.name ?? "",
				ownerEmail: row.owner?.email ?? "",
				product: row.product?.name ?? "",
				stage: formatDealStage(row.stage),
				amount: formatAmount(row.amount),
				currency: row.currency,
				expectedCloseDate: row.expectedCloseDate
					? row.expectedCloseDate.toISOString().slice(0, 10)
					: "",
				closedReason: row.closedReason ?? "",
			})),
		);

		const day = new Date().toISOString().slice(0, 10);
		return {
			csv,
			filename: `deals-${day}.csv`,
			rowCount: rows.length,
		};
	}

	importTemplate() {
		return {
			csv: dealCsvTemplate(),
			filename: "deals-import-template.csv",
		};
	}

	async importCsv(input: DealImportInput, actingUserId: string) {
		const parsed = parseDealCsv(input.csv);
		let created = 0;
		let updated = 0;
		const errors: { line: number; message: string }[] = [];

		for (const [index, row] of parsed.entries()) {
			const line = index + 2;
			try {
				const name = row.name.trim();
				if (!name) {
					throw new BadRequestException("name is required.");
				}

				const stage = parseDealStage(row.stage);
				if (row.stage.trim() && stage === undefined) {
					throw new BadRequestException(`Unknown stage "${row.stage}".`);
				}

				const amountCents = parseAmountCents(row.amount);
				const companyId = row.company.trim()
					? await this.resolveCompanyId(row.company)
					: undefined;
				const ownerId = row.ownerEmail.trim()
					? await this.resolveOwnerId(row.ownerEmail)
					: undefined;
				const productId = row.product.trim()
					? await this.resolveProductId(row.product)
					: undefined;

				let currency: string | undefined;
				if (row.currency.trim()) {
					const code = normalizeCurrency(row.currency);
					if (!isCurrencyCode(code)) {
						throw new BadRequestException(
							`Unknown currency "${row.currency}".`,
						);
					}
					currency = code;
				}

				const existing =
					companyId !== undefined
						? await this.db.deal.findFirst({
								where: {
									name: { equals: name, mode: "insensitive" },
									companyId,
									archivedAt: null,
								},
								select: { id: true, stage: true },
							})
						: null;

				if (existing) {
					await this.update(existing.id, {
						name,
						...(companyId !== undefined ? { companyId } : {}),
						...(ownerId !== undefined ? { ownerId } : {}),
						...(productId !== undefined ? { productId } : {}),
						...(amountCents !== undefined ? { amountCents } : {}),
						...(currency !== undefined ? { currency } : {}),
						...(row.expectedCloseDate.trim()
							? { expectedCloseDate: row.expectedCloseDate }
							: {}),
					});
					if (stage !== undefined && stage !== existing.stage) {
						await this.setStage(
							{
								id: existing.id,
								stage,
								closedReason: row.closedReason.trim() || "Imported via CSV",
							},
							actingUserId,
						);
					}
					updated += 1;
					continue;
				}

				if (!companyId) {
					throw new BadRequestException("company is required for new deals.");
				}
				if (!ownerId) {
					throw new BadRequestException("ownerEmail is required for new deals.");
				}

				await this.create({
					name,
					companyId,
					ownerId,
					productId: productId ?? null,
					stage,
					amountCents,
					currency,
					expectedCloseDate: row.expectedCloseDate || null,
				});
				created += 1;
			} catch (error) {
				errors.push({
					line,
					message: error instanceof Error ? error.message : "Import failed.",
				});
			}
		}

		this.logger.log({
			message: "Deals imported",
			created,
			updated,
			failed: errors.length,
		});

		return {
			created,
			updated,
			failed: errors.length,
			errors: errors.slice(0, 50),
		};
	}

	async byId(id: string) {
		const deal = await this.db.deal.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				description: true,
				stage: true,
				stageChangedAt: true,
				amount: true,
				currency: true,
				baseAmount: true,
				fxRate: true,
				fxRateAt: true,
				expectedCloseDate: true,
				closedAt: true,
				closedReason: true,
				createdAt: true,
				archivedAt: true,
				company: { select: { ...COMPANY_SELECT, industry: true } },
				owner: { select: OWNER_SELECT },
				contacts: {
					select: { role: true, contact: { select: CONTACT_SELECT } },
					orderBy: { contact: { firstName: "asc" } },
				},
			},
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${id}.`);
		}

		const {
			contacts,
			amount,
			baseAmount,
			fxRate,
			fxRateAt,
			archivedAt,
			...rest
		} = deal;

		return {
			...rest,
			fields: await this.fields.valuesFor("DEAL", id),
			amountCents: toCents(amount),
			baseAmountCents: toCents(baseAmount),
			reportingCurrency: await this.conversion.reportingCurrency(),
			fxRate: fxRate?.toNumber() ?? null,
			fxRateAt: fxRateAt?.toISOString() ?? null,
			stageChangedAt: deal.stageChangedAt.toISOString(),
			expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			closedAt: deal.closedAt?.toISOString() ?? null,
			createdAt: deal.createdAt.toISOString(),
			archivedAt: archivedAt?.toISOString() ?? null,
			contacts: contacts.map(({ role, contact }) => ({ ...contact, role })),
		};
	}

	async create(input: DealCreateInput) {
		const stage = input.stage ?? "DEMO_BOOKED";
		const closed = isClosedStage(stage);
		const now = new Date();

		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.dealFields(
			decimalFromCents(input.amountCents),
			currency,
		);

		try {
			const deal = await this.agent.withCrmEvents(async (tx, emit) => {
				const created = await tx.deal.create({
					data: {
						name: input.name.trim(),
						companyId: input.companyId,
						ownerId: input.ownerId,
						productId: input.productId ?? null,
						stage,
						stageChangedAt: now,
						closedAt: closed ? now : null,
						amount: fromCents(input.amountCents),
						currency,
						...fx,
						expectedCloseDate: parseDate(input.expectedCloseDate),
					},
					select: { id: true, name: true, companyId: true },
				});
				await emit({
					type: "deal.created",
					record: { kind: "deal", id: created.id },
					occurredAt: now,
					data: { companyId: created.companyId, stage },
				});
				if (closed) {
					await emit({
						type: "deal.closed",
						record: { kind: "deal", id: created.id },
						occurredAt: now,
						data: { companyId: created.companyId, from: null, to: stage },
					});
				}
				return created;
			});

			this.logger.log({ message: "Deal created", dealId: deal.id, stage });

			void this.fields.queueBackfillForNewRecord("DEAL", deal.id);

			return deal;
		} catch (error) {
			throw this.translateRelations(error);
		}
	}

	async update(id: string, input: DealUpdateInput) {
		const data: Prisma.DealUpdateInput = {};

		if (input.name !== undefined) data.name = input.name.trim();
		if (input.description !== undefined) {
			data.description =
				input.description === null ? null : blankToNull(input.description);
		}
		if (input.companyId !== undefined) {
			data.company = { connect: { id: input.companyId } };
		}
		if (input.ownerId !== undefined) {
			data.owner = { connect: { id: input.ownerId } };
		}
		if (input.productId !== undefined) {
			data.product = input.productId
				? { connect: { id: input.productId } }
				: { disconnect: true };
		}
		if (input.amountCents !== undefined) {
			data.amount = fromCents(input.amountCents);
		}
		if (input.currency !== undefined) {
			data.currency = normalizeCurrency(input.currency);
		}
		if (input.expectedCloseDate !== undefined) {
			data.expectedCloseDate = parseDate(input.expectedCloseDate);
		}

		if (input.amountCents !== undefined || input.currency !== undefined) {
			const current = await this.db.deal.findUnique({
				where: { id },
				select: { amount: true, currency: true },
			});

			if (!current) {
				throw new NotFoundException(`No deal with id ${id}.`);
			}

			const amount =
				input.amountCents !== undefined
					? decimalFromCents(input.amountCents)
					: current.amount;
			const currency =
				input.currency !== undefined
					? normalizeCurrency(input.currency)
					: normalizeCurrency(current.currency);

			Object.assign(data, await this.conversion.dealFields(amount, currency));
		}

		try {
			return await this.db.$transaction(async (tx) => {
				if (input.fields) {
					await this.fields.applyValues(tx, "DEAL", id, input.fields);
				}

				return tx.deal.update({
					where: { id },
					data,
					select: { id: true, name: true },
				});
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async archive(id: string): Promise<{ id: string; name: string }> {
		try {
			const deal = await this.db.deal.update({
				where: { id },
				data: { archivedAt: new Date() },
				select: { name: true },
			});

			this.logger.log({ message: "Deal archived", dealId: id });

			return { id, name: deal.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async restore(id: string): Promise<{ id: string; name: string }> {
		try {
			const deal = await this.db.deal.update({
				where: { id },
				data: { archivedAt: null },
				select: { name: true },
			});

			this.logger.log({ message: "Deal restored", dealId: id });

			return { id, name: deal.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async purge(id: string): Promise<{ id: string; name: string }>;
	async purge(
		id: string,
		guard: { archivedBefore: Date },
	): Promise<{ id: string; name: string } | null>;
	async purge(
		id: string,
		guard?: { archivedBefore: Date },
	): Promise<{ id: string; name: string } | null> {
		let deleted: { targets: StampTargets; name: string } | null;

		try {
			deleted = await this.db.$transaction(async (tx) => {
				const [row] = await tx.$queryRaw<Array<{ archivedAt: Date | null }>>`
					SELECT "archivedAt" FROM deal WHERE id = ${id} FOR UPDATE
				`;

				if (!row) {
					if (guard) return null;
					throw new NotFoundException(`No deal with id ${id}.`);
				}
				if (
					guard &&
					(!row.archivedAt || row.archivedAt > guard.archivedBefore)
				) {
					return null;
				}

				const targets = await this.stamp.targetsOf({ dealId: id }, tx);
				await tx.agentTask.deleteMany({ where: { dealId: id } });

				const deal = await tx.deal.delete({
					where: { id },
					select: { name: true },
				});

				return { targets, name: deal.name };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		if (!deleted) return null;

		await this.stamp.recomputeAfterDelete(deleted.targets, { dealId: id });

		this.logger.log({
			message: "Deal purged",
			dealId: id,
			name: deleted.name,
		});

		return { id, name: deleted.name };
	}

	async purgeExpired(before: Date): Promise<BulkResult> {
		const expired = await this.db.deal.findMany({
			where: { archivedAt: { lte: before } },
			select: { id: true },
			take: ARCHIVE.prune.maxBatch,
		});

		return runBulk(
			expired.map((row) => row.id),
			(id) => this.purge(id, { archivedBefore: before }),
		);
	}

	async setStage(input: SetStageInput, actingUserId: string) {
		const closedReason = input.closedReason?.trim();
		const closed = isClosedStage(input.stage);
		const transition = await this.agent.withCrmEvents(async (tx, emit) => {
			const [deal] = await tx.$queryRaw<
				Array<{ id: string; stage: DealStage; companyId: string }>
			>`
				SELECT id, stage, "companyId"
				FROM deal
				WHERE id = ${input.id}
				FOR UPDATE
			`;

			if (!deal) {
				throw new NotFoundException(`No deal with id ${input.id}.`);
			}

			if (deal.stage === input.stage) {
				return {
					changed: false as const,
					deal,
					updated: { id: deal.id, stage: deal.stage },
					now: null,
				};
			}
			if (LOSING.has(input.stage) && !closedReason) {
				throw new BadRequestException(
					"Say why it was lost — a closed-lost deal with no reason teaches nobody anything.",
				);
			}

			const now = new Date();
			const updated = await tx.deal.update({
				where: { id: input.id },
				data: {
					stage: input.stage,
					stageChangedAt: now,
					closedAt: closed ? now : null,
					closedReason: closed ? (closedReason ?? null) : null,
				},
				select: { id: true, stage: true },
			});
			await tx.activity.create({
				data: {
					type: ActivityType.STAGE_CHANGE,
					subject: "Stage changed",
					body: closedReason ?? null,
					occurredAt: now,
					companyId: deal.companyId,
					dealId: deal.id,
					createdById: actingUserId,
					meta: { from: deal.stage, to: input.stage },
				},
			});
			await emit({
				type: "deal.stage.changed",
				record: { kind: "deal", id: deal.id },
				occurredAt: now,
				data: { companyId: deal.companyId, from: deal.stage, to: input.stage },
			});
			if (!isClosedStage(deal.stage) && closed) {
				await emit({
					type: "deal.closed",
					record: { kind: "deal", id: deal.id },
					occurredAt: now,
					data: {
						companyId: deal.companyId,
						from: deal.stage,
						to: input.stage,
					},
				});
			}
			if (isClosedStage(deal.stage) && !closed) {
				await emit({
					type: "deal.opened",
					record: { kind: "deal", id: deal.id },
					occurredAt: now,
					data: {
						companyId: deal.companyId,
						from: deal.stage,
						to: input.stage,
					},
				});
			}

			return { changed: true as const, deal, updated, now };
		});

		if (!transition.changed) {
			return { ...transition.updated, changed: false };
		}

		const { deal, updated, now } = transition;

		await this.stamp.touch({ companyId: deal.companyId, dealId: deal.id }, now);

		this.logger.log({
			message: "Deal stage changed",
			dealId: deal.id,
			from: deal.stage,
			to: input.stage,
		});

		return { ...updated, changed: true };
	}

	async contactOptions(dealId: string) {
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { companyId: true, contacts: { select: { contactId: true } } },
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${dealId}.`);
		}

		return this.db.contact.findMany({
			where: {
				companyId: deal.companyId,
				id: { notIn: deal.contacts.map((row) => row.contactId) },
			},
			select: CONTACT_SELECT,
			orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
			take: 100,
		});
	}

	async attachContact(input: DealAttachContactInput) {
		const company = await this.companyOf(input.dealId);
		const contact = await this.db.contact.findUnique({
			where: { id: input.contactId },
			select: { companyId: true },
		});

		if (!contact) {
			throw new NotFoundException(`No contact with id ${input.contactId}.`);
		}

		if (contact.companyId !== company.id) {
			throw new BadRequestException(
				`That contact does not work at ${company.name}.`,
			);
		}

		const role = roleOrNull(input.role ?? null);

		await this.db.dealContact.upsert({
			where: {
				dealId_contactId: {
					dealId: input.dealId,
					contactId: input.contactId,
				},
			},
			create: { dealId: input.dealId, contactId: input.contactId, role },
			update: role === null ? {} : { role },
		});

		this.logger.log({
			message: "Contact attached to deal",
			dealId: input.dealId,
			contactId: input.contactId,
		});

		return { dealId: input.dealId, contactId: input.contactId };
	}

	async detachContact(input: DealDetachContactInput) {
		const { count } = await this.db.dealContact.deleteMany({
			where: { dealId: input.dealId, contactId: input.contactId },
		});

		if (count === 0) {
			throw new NotFoundException("That contact is not on this deal.");
		}

		this.logger.log({
			message: "Contact detached from deal",
			dealId: input.dealId,
			contactId: input.contactId,
		});

		return { dealId: input.dealId, contactId: input.contactId };
	}

	async setContactRole(input: DealContactRoleInput) {
		const role = roleOrNull(input.role);

		const { count } = await this.db.dealContact.updateMany({
			where: { dealId: input.dealId, contactId: input.contactId },
			data: { role },
		});

		if (count === 0) {
			throw new NotFoundException("That contact is not on this deal.");
		}

		return { dealId: input.dealId, contactId: input.contactId, role };
	}

	async bulkAssignOwner(input: DealBulkOwnerInput): Promise<BulkResult> {
		await requireOwner(this.db, input.ownerId);

		const ids = [...new Set(input.ids)];
		const { count } = await this.db.deal.updateMany({
			where: { id: { in: ids } },
			data: { ownerId: input.ownerId },
		});

		this.logger.log({
			message: "Deals reassigned",
			count,
			ownerId: input.ownerId,
		});

		return {
			requested: ids.length,
			succeeded: count,
			skipped: 0,
			failed: ids.length - count,
			message: null,
		};
	}

	async bulkSetStage(
		input: DealBulkStageInput,
		actingUserId: string,
	): Promise<BulkResult> {
		const closedReason = input.closedReason?.trim();

		if (LOSING.has(input.stage) && !closedReason) {
			throw new BadRequestException(
				"Say why they were lost — a closed-lost deal with no reason teaches nobody anything.",
			);
		}

		return runBulk(input.ids, (id) =>
			this.setStage({ id, stage: input.stage, closedReason }, actingUserId),
		);
	}

	async bulkArchive(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.archive(id));
	}

	async bulkRestore(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.restore(id));
	}

	async bulkPurge(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.purge(id));
	}

	private async companyOf(dealId: string) {
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { company: { select: { id: true, name: true } } },
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${dealId}.`);
		}

		return deal.company;
	}

	private searchFilter(q: string): Prisma.DealWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				{ company: { name: { contains: term, mode: "insensitive" } } },
			],
		};
	}

	private buildWhere(
		input: DealListInput,
		filterableFields: FieldDefinitionWithOptions[],
	): Prisma.DealWhereInput {
		const and: Prisma.DealWhereInput[] = [
			this.searchFilter(input.q),
			archivedFilter(input.archived),
			...this.fields.fieldFilters(filterableFields, input.fields),
		];

		const owner = ownerFilter<Prisma.DealWhereInput>(input.owner);
		if (owner) and.push(owner);

		if (input.company.length > 0) {
			and.push({ companyId: { in: input.company } });
		}

		if (input.status === "open") {
			and.push({ stage: { in: [...OPEN_DEAL_STAGES] } });
		} else if (input.status === "closed") {
			and.push({ stage: { in: [...CLOSED_DEAL_STAGES] } });
		}

		if (input.stage.length > 0) {
			and.push({ stage: { in: input.stage as DealStage[] } });
		}

		if (input.product.length > 0) {
			const { ids, includesSentinel } = splitSentinel(
				input.product,
				NO_PRODUCT,
			);
			if (includesSentinel && ids.length === 0) {
				and.push({ productId: null });
			} else if (!includesSentinel) {
				and.push({ productId: { in: ids } });
			} else {
				and.push({
					OR: [{ productId: { in: ids } }, { productId: null }],
				});
			}
		}

		if (input.closing.length > 0) {
			and.push({
				OR: input.closing.map((window) =>
					closingFilter(window as ClosingWindow),
				),
			});
		}

		return { AND: and };
	}

	private async facetCounts(
		input: DealListInput,
		filterableFields: FieldDefinitionWithOptions[],
	) {
		const where: Prisma.DealWhereInput = {
			AND: [this.searchFilter(input.q), archivedFilter(input.archived)],
		};

		const [owners, companies, stages, products, fieldFacets, ...closingCounts] =
			await Promise.all([
				this.db.deal.groupBy({
					by: ["ownerId"],
					where,
					_count: { _all: true },
				}),
				this.db.deal.groupBy({
					by: ["companyId"],
					where,
					_count: { _all: true },
				}),
				this.db.deal.groupBy({ by: ["stage"], where, _count: { _all: true } }),
				this.db.deal.groupBy({
					by: ["productId"],
					where,
					_count: { _all: true },
				}),
				this.fields.filterFacetCounts("DEAL", where, filterableFields),
				...CLOSING_WINDOWS.map((window) =>
					this.db.deal.count({
						where: { AND: [where, closingFilter(window)] },
					}),
				),
			]);

		const stageCounts = countsByKey(stages, "stage");
		const openCount = OPEN_DEAL_STAGES.reduce(
			(total, stage) => total + (stageCounts[stage] ?? 0),
			0,
		);
		const closedCount = CLOSED_DEAL_STAGES.reduce(
			(total, stage) => total + (stageCounts[stage] ?? 0),
			0,
		);

		return {
			status: { open: openCount, closed: closedCount },
			owner: countsByKey(owners, "ownerId", FACET_UNASSIGNED),
			company: countsByKey(companies, "companyId"),
			stage: stageCounts,
			product: countsByKey(products, "productId", NO_PRODUCT),
			closing: Object.fromEntries(
				CLOSING_WINDOWS.map((window, index) => [
					window,
					closingCounts[index] ?? 0,
				]),
			),
			...Object.fromEntries(
				Object.entries(fieldFacets).map(([key, counts]) => [
					`field:${key}`,
					counts,
				]),
			),
		};
	}

	private async resolveCompanyId(name: string): Promise<string> {
		const trimmed = name.trim();
		const company = await this.db.company.findFirst({
			where: {
				name: { equals: trimmed, mode: "insensitive" },
				archivedAt: null,
			},
			select: { id: true },
		});
		if (!company) {
			throw new BadRequestException(`No company named "${trimmed}".`);
		}
		return company.id;
	}

	private async resolveOwnerId(email: string): Promise<string> {
		const normalized = normalizeEmail(email);
		if (!normalized) {
			throw new BadRequestException("ownerEmail is required.");
		}
		const user = await this.db.user.findFirst({
			where: { email: { equals: normalized, mode: "insensitive" } },
			select: { id: true },
		});
		if (!user) {
			throw new BadRequestException(`No owner with email ${normalized}.`);
		}
		return user.id;
	}

	private async resolveProductId(name: string): Promise<string> {
		const trimmed = name.trim();
		const product = await this.db.product.findFirst({
			where: {
				name: { equals: trimmed, mode: "insensitive" },
				archivedAt: null,
			},
			select: { id: true },
		});
		if (!product) {
			throw new BadRequestException(`No product named "${trimmed}".`);
		}
		return product.id;
	}

	private translate(cause: unknown, id: string): never {
		if (
			cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			cause.code === "P2025"
		) {
			throw new NotFoundException(`No deal with id ${id}.`);
		}
		return this.translateRelations(cause);
	}

	private translateRelations(cause: unknown): never {
		if (
			cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			(cause.code === "P2003" || cause.code === "P2025")
		) {
			throw new BadRequestException(
				"That company or owner does not exist any more.",
			);
		}
		throw cause;
	}
}

function closingFilter(window: ClosingWindow): Prisma.DealWhereInput {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const startOfMonthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);

	switch (window) {
		case "overdue":
			return {
				expectedCloseDate: { lt: now },
				stage: { in: [...OPEN_DEAL_STAGES] },
			};
		case "this-month":
			return {
				expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
			};
		case "next-month":
			return {
				expectedCloseDate: { gte: startOfNextMonth, lt: startOfMonthAfter },
			};
		case "later":
			return { expectedCloseDate: { gte: startOfMonthAfter } };
		case "none":
			return { expectedCloseDate: null };
	}
}

function roleOrNull(value: string | null): string | null {
	return value === null ? null : blankToNull(value);
}

function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}
