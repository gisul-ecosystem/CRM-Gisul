import {
	type Db,
	type EnrichmentStatus,
	type Prisma,
	Prisma as PrismaNamespace,
	type RecordSource,
} from "@crm/db";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import type { FieldDefinitionWithOptions } from "@crm/db/fields";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentQueueService } from "../agent/agent-queue.service";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { ARCHIVE } from "../archive/archive-config";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, requireOwner, runBulk } from "../crm/bulk";
import { blankToNull, normalizeEmail, toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import {
	activityFacetCounts,
	activityFilter,
	archivedFilter,
	countsByKey,
	FACET_UNASSIGNED,
	type ListResult,
	type OrderByColumns,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import {
	companyCsvTemplate,
	parseCompanyCsv,
	serializeCompanyCsv,
} from "./companies-csv";
import type {
	CompanyBulkOwnerInput,
	CompanyCreateInput,
	CompanyExportInput,
	CompanyImportInput,
	CompanyListInput,
	CompanyRow,
	CompanyUpdateInput,
} from "./companies.contracts";
import { COMPANY_IO } from "./companies-io-config";
import { normalizeDomain } from "./domain";
import { FaviconService } from "./favicon.service";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SORTABLE: OrderByColumns<Prisma.CompanyOrderByWithRelationInput> = {
	name: (dir) => ({ name: dir }),
	domain: (dir) => ({ domain: dir }),
	industry: (dir) => ({ industry: dir }),
	createdAt: (dir) => ({ createdAt: dir }),
	contacts: (dir) => ({ contacts: { _count: dir } }),
	deals: (dir) => ({ deals: { _count: dir } }),
	owner: (dir) => ({ owner: { name: dir } }),
	lastActivity: (dir) => ({ lastActivityAt: { sort: dir, nulls: "last" } }),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

@Injectable()
export class CompaniesService {
	private readonly logger = new Logger(CompaniesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly queue: AgentQueueService,
		private readonly favicon: FaviconService,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
	) {}

	async list(input: CompanyListInput): Promise<ListResult<CompanyRow>> {
		const filterableFields = await this.fields.filterableFieldsFor("COMPANY");
		const where = this.buildWhere(input, filterableFields);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			this.db.company.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, {
					createdAt: "desc",
				}),
				select: {
					id: true,
					name: true,
					domain: true,
					iconUrl: true,
					iconDarkUrl: true,
					iconTone: true,
					logoUrl: true,
					brandColor: true,
					industry: true,
					enrichmentStatus: true,
					source: true,
					owner: { select: OWNER_SELECT },
					primaryContact: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							title: true,
							product: {
								select: { id: true, name: true, color: true, iconUrl: true },
							},
						},
					},
					deals: {
						where: {
							archivedAt: null,
							stage: { in: [...OPEN_DEAL_STAGES] },
							productId: { not: null },
						},
						orderBy: { updatedAt: "desc" },
						take: 1,
						select: {
							product: {
								select: { id: true, name: true, color: true, iconUrl: true },
							},
						},
					},
					_count: {
						select: {
							contacts: true,
							deals: { where: { stage: { in: [...OPEN_DEAL_STAGES] } } },
						},
					},
					lastActivityAt: true,
					createdAt: true,
					archivedAt: true,
				},
			}),
			this.db.company.count({ where }),
			this.facetCounts(input, filterableFields),
		]);

		const ids = rows.map((row) => row.id);
		const [queued, tableFields] = await Promise.all([
			this.queue.queuedCompanies(ids),
			this.fields.tableValuesFor("COMPANY", ids),
		]);

		return {
			rows: rows.map((row) => {
				const contact = row.primaryContact;
				const product = contact?.product ?? row.deals[0]?.product ?? null;

				return {
					id: row.id,
					name: row.name,
					domain: row.domain,
					iconUrl: row.iconUrl,
					iconDarkUrl: row.iconDarkUrl,
					iconTone: row.iconTone,
					logoUrl: row.logoUrl,
					brandColor: row.brandColor,
					industry: row.industry,
					enrichmentStatus: row.enrichmentStatus,
					queued: queued.has(row.id),
					source: row.source,
					owner: row.owner,
					product,
					primaryContact: contact
						? {
								id: contact.id,
								firstName: contact.firstName,
								lastName: contact.lastName,
								email: contact.email,
								title: contact.title,
							}
						: null,
					contactCount: row._count.contacts,
					openDealCount: row._count.deals,
					lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
					createdAt: row.createdAt.toISOString(),
					archivedAt: row.archivedAt?.toISOString() ?? null,
					fields: tableFields.get(row.id) ?? {},
				};
			}),
			total,
			facetCounts,
		};
	}

	async byId(id: string) {
		const company = await this.db.company.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				domain: true,
				website: true,
				description: true,
				logoUrl: true,
				logoDarkUrl: true,
				iconUrl: true,
				iconDarkUrl: true,
				iconTone: true,
				brandColor: true,
				industry: true,
				subIndustry: true,
				city: true,
				stateCode: true,
				country: true,
				countryCode: true,
				phone: true,
				email: true,
				linkedinUrl: true,
				twitterUrl: true,
				githubUrl: true,
				pricingUrl: true,
				careersUrl: true,
				enrichmentStatus: true,
				enrichedAt: true,
				enrichmentError: true,
				source: true,
				createdAt: true,
				archivedAt: true,
				owner: { select: OWNER_SELECT },
				primaryContact: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						title: true,
					},
				},
				contacts: {
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						title: true,
						imageUrl: true,
						owner: { select: OWNER_SELECT },
					},
				},
				deals: {
					orderBy: [{ stage: "asc" }, { expectedCloseDate: "asc" }],
					select: {
						id: true,
						name: true,
						stage: true,
						amount: true,
						currency: true,
						baseAmount: true,
						expectedCloseDate: true,
						owner: { select: OWNER_SELECT },
					},
				},
			},
		});

		if (!company) {
			throw new NotFoundException(`No company with id ${id}.`);
		}

		const {
			deals,
			primaryContact,
			enrichedAt,
			createdAt,
			archivedAt,
			...rest
		} = company;

		return {
			...rest,
			fields: await this.fields.valuesFor("COMPANY", id),
			queued: await this.queue.isQueued({ companyId: id }),
			createdAt: createdAt.toISOString(),
			archivedAt: archivedAt?.toISOString() ?? null,
			enrichedAt: enrichedAt?.toISOString() ?? null,
			primaryContactId: primaryContact?.id ?? null,
			primaryContact,
			reportingCurrency: await this.conversion.reportingCurrency(),
			deals: deals.map((deal) => ({
				...deal,
				amount: undefined,
				baseAmount: undefined,
				amountCents: toCents(deal.amount),
				baseAmountCents: toCents(deal.baseAmount),
				expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			})),
		};
	}

	async options(q: string) {
		return this.db.company.findMany({
			where: this.searchFilter(q),
			select: { id: true, name: true, domain: true, iconUrl: true },
			orderBy: { name: "asc" },
			take: 100,
		});
	}

	async create(input: CompanyCreateInput) {
		const domain = normalizeDomain(input.domain);

		if (domain) {
			const existing = await this.db.company.findFirst({
				where: { domain, archivedAt: null },
				select: { id: true, name: true },
			});
			if (existing) {
				throw new ConflictException(
					`${existing.name} already uses the domain ${domain}.`,
				);
			}
		}

		const company = await this.agent.withCrmEvents(async (tx, emit) => {
			const created = await tx.company.create({
				data: {
					name: input.name.trim(),
					domain,
					website: domain ? `https://${domain}` : null,
					ownerId: input.ownerId ?? null,
				},
				select: { id: true, name: true, domain: true, createdAt: true },
			});
			await emit({
				type: "company.created",
				record: { kind: "company", id: created.id },
				occurredAt: created.createdAt,
				data: { name: created.name, domain: created.domain },
			});
			return created;
		});

		this.logger.log({
			message: "Company created",
			companyId: company.id,
			domain: company.domain,
		});

		await this.agent.companyCreated(company.id);

		void this.favicon.backfill(company.id, company.domain);
		void this.fields.queueBackfillForNewRecord("COMPANY", company.id);

		return { id: company.id, name: company.name, domain: company.domain };
	}

	async update(id: string, input: CompanyUpdateInput) {
		const data: Prisma.CompanyUpdateInput = {};

		if (input.name !== undefined) data.name = input.name.trim();
		if (input.website !== undefined) data.website = blankToNull(input.website);
		if (input.description !== undefined) {
			data.description = blankToNull(input.description);
		}
		if (input.industry !== undefined)
			data.industry = blankToNull(input.industry);
		if (input.city !== undefined) data.city = blankToNull(input.city);
		if (input.stateCode !== undefined) {
			data.stateCode = blankToNull(input.stateCode);
		}
		if (input.country !== undefined) data.country = blankToNull(input.country);
		if (input.phone !== undefined) data.phone = blankToNull(input.phone);
		if (input.email !== undefined) data.email = blankToNull(input.email);
		if (input.linkedinUrl !== undefined) {
			data.linkedinUrl = blankToNull(input.linkedinUrl);
		}
		if (input.ownerId !== undefined) {
			data.owner = input.ownerId
				? { connect: { id: input.ownerId } }
				: { disconnect: true };
		}

		if (input.domain !== undefined) {
			const domain = normalizeDomain(input.domain);
			if (input.domain.trim() && !domain) {
				throw new BadRequestException(
					`"${input.domain}" is not a domain — try something like "stripe.com".`,
				);
			}
			data.domain = domain;
			const current = await this.db.company.findUnique({
				where: { id },
				select: { domain: true },
			});
			if (current && current.domain !== domain) {
				data.enrichmentStatus = "PENDING";
				data.enrichmentError = null;
				data.iconUrl = null;
				data.iconDarkUrl = null;
				data.iconTone = null;
			}
		}

		try {
			const updated = await this.db.$transaction(async (tx) => {
				if (input.fields) {
					await this.fields.applyValues(tx, "COMPANY", id, input.fields);
				}

				return tx.company.update({
					where: { id },
					data,
					select: { id: true, name: true, domain: true },
				});
			});

			if (data.enrichmentStatus === "PENDING") {
				await this.agent.companyCreated(
					id,
					"Domain changed — anything we knew was about a different company",
				);
				void this.favicon.backfill(id, updated.domain);
			}

			return updated;
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async archive(id: string): Promise<{ id: string; name: string }> {
		try {
			const company = await this.db.company.update({
				where: { id },
				data: { archivedAt: new Date() },
				select: { name: true },
			});

			this.logger.log({ message: "Company archived", companyId: id });

			return { id, name: company.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async restore(id: string): Promise<{ id: string; name: string }> {
		try {
			const company = await this.db.company.update({
				where: { id },
				data: { archivedAt: null },
				select: { name: true },
			});

			this.logger.log({ message: "Company restored", companyId: id });

			return { id, name: company.name };
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
					SELECT "archivedAt" FROM company WHERE id = ${id} FOR UPDATE
				`;

				if (!row) {
					if (guard) return null;
					throw new NotFoundException(`No company with id ${id}.`);
				}
				if (
					guard &&
					(!row.archivedAt || row.archivedAt > guard.archivedBefore)
				) {
					return null;
				}

				const targets = await this.stamp.targetsOf(
					{ OR: [{ companyId: id }, { deal: { companyId: id } }] },
					tx,
				);

				const deals = await tx.deal.findMany({
					where: { companyId: id },
					select: { id: true },
				});

				await tx.agentTask.deleteMany({
					where: {
						OR: [
							{ companyId: id },
							{ dealId: { in: deals.map((deal) => deal.id) } },
						],
					},
				});

				const company = await tx.company.delete({
					where: { id },
					select: { name: true },
				});

				return { targets, name: company.name };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		if (!deleted) return null;

		await this.stamp.recomputeAfterDelete(deleted.targets, { companyId: id });

		this.logger.log({
			message: "Company purged",
			companyId: id,
			name: deleted.name,
		});

		return { id, name: deleted.name };
	}

	async purgeExpired(before: Date): Promise<BulkResult> {
		const expired = await this.db.company.findMany({
			where: { archivedAt: { lte: before } },
			select: { id: true },
			take: ARCHIVE.prune.maxBatch,
		});

		return runBulk(
			expired.map((row) => row.id),
			(id) => this.purge(id, { archivedBefore: before }),
		);
	}

	async bulkAssignOwner(input: CompanyBulkOwnerInput): Promise<BulkResult> {
		const ownerId = input.ownerId || null;

		await requireOwner(this.db, ownerId);

		const ids = [...new Set(input.ids)];
		const { count } = await this.db.company.updateMany({
			where: { id: { in: ids } },
			data: { ownerId },
		});

		this.logger.log({
			message: "Companies reassigned",
			count,
			ownerId,
		});

		return {
			requested: ids.length,
			succeeded: count,
			skipped: 0,
			failed: ids.length - count,
			message: null,
		};
	}

	async bulkEnrich(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.enrich(id));
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

	async enrich(id: string): Promise<{ id: string; queued: boolean }> {
		const company = await this.db.company.findUnique({
			where: { id },
			select: { id: true, updatedAt: true },
		});

		if (!company) {
			throw new NotFoundException(`No company with id ${id}.`);
		}

		const queued = await this.agent.companyRequested(
			id,
			"A rep asked for a fresh look",
		);

		if (queued) {
			await this.db.company.updateMany({
				where: { id, updatedAt: company.updatedAt },
				data: { enrichmentStatus: "PENDING", enrichmentError: null },
			});
		}

		return { id, queued };
	}

	async research(id: string, actingUserId: string) {
		const company = await this.db.company.findUnique({
			where: { id },
			select: { id: true, domain: true },
		});

		if (!company) {
			throw new NotFoundException(`No company with id ${id}.`);
		}

		if (!company.domain) {
			throw new BadRequestException(
				"There is nothing to read without a domain — add one first.",
			);
		}

		const queued = await this.agent.companyRequested(
			id,
			`Briefing requested by a rep (${actingUserId})`,
		);

		return { ok: true as const, queued };
	}

	async exportCsv(input: CompanyExportInput) {
		const filterableFields = await this.fields.filterableFieldsFor("COMPANY");
		const where = this.buildWhere(input, filterableFields);

		const total = await this.db.company.count({ where });
		if (total > COMPANY_IO.export.maxRows) {
			throw new BadRequestException(
				`Export is capped at ${COMPANY_IO.export.maxRows} companies. Narrow the filters first.`,
			);
		}

		const rows = await this.db.company.findMany({
			where,
			orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "desc" }),
			take: COMPANY_IO.export.maxRows,
			select: {
				name: true,
				domain: true,
				industry: true,
				website: true,
				phone: true,
				email: true,
				owner: { select: { email: true } },
			},
		});

		const csv = serializeCompanyCsv(
			rows.map((row) => ({
				name: row.name,
				domain: row.domain ?? "",
				ownerEmail: row.owner?.email ?? "",
				industry: row.industry ?? "",
				website: row.website ?? "",
				phone: row.phone ?? "",
				email: row.email ?? "",
			})),
		);

		const day = new Date().toISOString().slice(0, 10);
		return {
			csv,
			filename: `companies-${day}.csv`,
			rowCount: rows.length,
		};
	}

	importTemplate() {
		return {
			csv: companyCsvTemplate(),
			filename: "companies-import-template.csv",
		};
	}

	async importCsv(input: CompanyImportInput) {
		const parsed = parseCompanyCsv(input.csv);
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

				let domain: string | undefined;
				if (row.domain.trim()) {
					const normalized = normalizeDomain(row.domain);
					if (!normalized) {
						throw new BadRequestException(
							`"${row.domain}" is not a domain — try something like "stripe.com".`,
						);
					}
					domain = normalized;
				}

				const ownerId = row.ownerEmail.trim()
					? await this.resolveOwnerId(row.ownerEmail)
					: undefined;

				const existing = domain
					? await this.db.company.findFirst({
							where: { domain, archivedAt: null },
							select: { id: true },
						})
					: await this.db.company.findFirst({
							where: {
								name: { equals: name, mode: "insensitive" },
								archivedAt: null,
							},
							select: { id: true },
						});

				const extras = {
					...(row.industry.trim() ? { industry: row.industry } : {}),
					...(row.website.trim() ? { website: row.website } : {}),
					...(row.phone.trim() ? { phone: row.phone } : {}),
					...(row.email.trim() ? { email: row.email } : {}),
				};

				if (existing) {
					await this.update(existing.id, {
						name,
						...(domain !== undefined ? { domain } : {}),
						...(ownerId !== undefined ? { ownerId } : {}),
						...extras,
					});
					updated += 1;
					continue;
				}

				const company = await this.create({
					name,
					domain,
					ownerId: ownerId ?? null,
				});

				if (Object.keys(extras).length > 0) {
					await this.update(company.id, extras);
				}
				created += 1;
			} catch (error) {
				errors.push({
					line,
					message: error instanceof Error ? error.message : "Import failed.",
				});
			}
		}

		this.logger.log({
			message: "Companies imported",
			created,
			updated,
			failed: errors.length,
		});

		return {
			created,
			updated,
			failed: errors.length,
			errors: errors.slice(0, 20),
		};
	}

	async setPrimaryContact(companyId: string, contactId: string | null) {
		if (contactId) {
			const contact = await this.db.contact.findUnique({
				where: { id: contactId },
				select: { companyId: true },
			});
			if (!contact) {
				throw new NotFoundException(`No contact with id ${contactId}.`);
			}
			if (contact.companyId !== companyId) {
				throw new BadRequestException(
					"That contact does not work at this company.",
				);
			}
		}

		try {
			return await this.db.company.update({
				where: { id: companyId },
				data: { primaryContactId: contactId },
				select: { id: true, primaryContactId: true },
			});
		} catch (error) {
			throw this.translate(error, companyId);
		}
	}

	private async resolveOwnerId(email: string): Promise<string | null> {
		const normalized = normalizeEmail(email);
		if (!normalized) return null;
		const user = await this.db.user.findFirst({
			where: { email: { equals: normalized, mode: "insensitive" } },
			select: { id: true },
		});
		if (!user) {
			throw new BadRequestException(`No owner with email ${normalized}.`);
		}
		return user.id;
	}

	private searchFilter(q: string): Prisma.CompanyWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				{ domain: { contains: term, mode: "insensitive" } },
			],
		};
	}

	private buildWhere(
		input: CompanyListInput,
		filterableFields: FieldDefinitionWithOptions[],
	): Prisma.CompanyWhereInput {
		const and: Prisma.CompanyWhereInput[] = [
			this.searchFilter(input.q),
			archivedFilter(input.archived),
			...this.fields.fieldFilters(filterableFields, input.fields),
		];

		const owner = ownerFilter<Prisma.CompanyWhereInput>(input.owner);
		if (owner) and.push(owner);

		if (input.product.length > 0) {
			const wantsNone = input.product.includes("none");
			const productIds = input.product.filter((id) => id !== "none");
			const productOr: Prisma.CompanyWhereInput[] = [];
			if (productIds.length > 0) {
				productOr.push({
					OR: [
						{ primaryContact: { productId: { in: productIds } } },
						{
							deals: {
								some: {
									archivedAt: null,
									stage: { in: [...OPEN_DEAL_STAGES] },
									productId: { in: productIds },
								},
							},
						},
					],
				});
			}
			if (wantsNone) {
				productOr.push({
					AND: [
						{
							OR: [
								{ primaryContactId: null },
								{ primaryContact: { productId: null } },
							],
						},
						{
							deals: {
								none: {
									archivedAt: null,
									stage: { in: [...OPEN_DEAL_STAGES] },
									productId: { not: null },
								},
							},
						},
					],
				});
			}
			if (productOr.length > 0) and.push({ OR: productOr });
		}

		if (input.industry.length > 0)
			and.push({ industry: { in: input.industry } });
		if (input.enrichment.length > 0) {
			and.push({
				enrichmentStatus: { in: input.enrichment as EnrichmentStatus[] },
			});
		}
		if (input.source.length > 0) {
			and.push({ source: { in: input.source as RecordSource[] } });
		}

		const activity = activityFilter(input.activity);
		if (activity) and.push(activity);

		return { AND: and };
	}

	private async facetCounts(
		input: CompanyListInput,
		filterableFields: FieldDefinitionWithOptions[],
	) {
		const where = {
			AND: [this.searchFilter(input.q), archivedFilter(input.archived)],
		};

		const [owners, industries, enrichment, sources, activity, fieldFacets] =
			await Promise.all([
				this.db.company.groupBy({
					by: ["ownerId"],
					where,
					_count: { _all: true },
				}),
				this.db.company.groupBy({
					by: ["industry"],
					where,
					_count: { _all: true },
				}),
				this.db.company.groupBy({
					by: ["enrichmentStatus"],
					where,
					_count: { _all: true },
				}),
				this.db.company.groupBy({
					by: ["source"],
					where,
					_count: { _all: true },
				}),
				activityFacetCounts((activityWhere) =>
					this.db.company.count({ where: { AND: [where, activityWhere] } }),
				),
				this.fields.filterFacetCounts("COMPANY", where, filterableFields),
			]);

		return {
			owner: countsByKey(owners, "ownerId", FACET_UNASSIGNED),
			industry: countsByKey(industries, "industry"),
			enrichment: countsByKey(enrichment, "enrichmentStatus"),
			source: countsByKey(sources, "source"),
			activity,
			...Object.fromEntries(
				Object.entries(fieldFacets).map(([key, counts]) => [
					`field:${key}`,
					counts,
				]),
			),
		};
	}

	private translate(cause: unknown, id: string): never {
		if (cause instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (cause.code === "P2025") {
				throw new NotFoundException(`No company with id ${id}.`);
			}
			if (cause.code === "P2002") {
				throw new ConflictException(
					"Another company already uses that domain.",
				);
			}
		}
		throw cause;
	}
}
