import { AZURE, contextWindowForAzureModel } from "@crm/db/azure-models";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { z } from "zod";

const CATALOG_KEY = "settings:model-catalog";

export interface CatalogModel {
	id: string;
	name: string;
	provider: string;
	contextWindowTokens: number;
	pricing: { input: number; output: number } | null;
}

const capabilities = z
	.object({
		chat_completion: z.boolean().optional(),
		embeddings: z.boolean().optional(),
	})
	.optional();

const deployment = z.object({
	id: z.string().trim().min(1),
	model: z.string().trim().min(1).optional(),
	status: z.string().optional(),
	capabilities,
});

const deploymentList = z.object({
	data: z.array(z.unknown()),
});

const v1Model = z.object({
	id: z.string().trim().min(1),
});

const v1ModelList = z.object({
	data: z.array(z.unknown()),
});

type Deployment = z.infer<typeof deployment>;

function credentials(): { endpoint: string; apiKey: string } | null {
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim().replace(
		/\/+$/,
		"",
	);
	const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
	if (!endpoint || !apiKey) return null;
	return { endpoint, apiKey };
}

function chatCapable(model: Deployment): boolean {
	if (model.status && model.status !== "succeeded") return false;
	const chat = model.capabilities?.chat_completion;
	const embeddings = model.capabilities?.embeddings === true;
	if (chat === false) return false;
	if (embeddings && chat !== true) return false;
	return true;
}

function toCatalogModel(id: string, modelName: string): CatalogModel {
	return {
		id,
		name: modelName && modelName !== id ? `${id} · ${modelName}` : id,
		provider: "Azure",
		contextWindowTokens: contextWindowForAzureModel(modelName || id),
		pricing: null,
	};
}

@Injectable()
export class ModelCatalogService {
	private readonly logger = new Logger(ModelCatalogService.name);

	constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

	async models(): Promise<CatalogModel[] | null> {
		const cached = await this.cache.get<CatalogModel[]>(CATALOG_KEY);
		if (cached) return cached;

		const models = await this.fetchCatalog();
		if (!models) return null;

		await this.cache.set(CATALOG_KEY, models, AZURE.catalog.ttlMs);
		return models;
	}

	async find(id: string): Promise<CatalogModel | null> {
		const models = await this.models();
		return models?.find((model) => model.id === id) ?? null;
	}

	private async fetchCatalog(): Promise<CatalogModel[] | null> {
		const auth = credentials();
		if (!auth) {
			this.logger.warn({
				message: "Azure OpenAI is not configured",
			});
			return null;
		}

		const fromDeployments = await this.fetchDeployments(auth);
		if (fromDeployments) return fromDeployments;

		return this.fetchV1Models(auth);
	}

	private async fetchDeployments(auth: {
		endpoint: string;
		apiKey: string;
	}): Promise<CatalogModel[] | null> {
		const url = `${auth.endpoint}/openai/deployments?api-version=${AZURE.catalogApiVersion}`;
		const body = await this.getJson(url, auth.apiKey);
		if (!body) return null;

		const parsed = deploymentList.safeParse(body);
		if (!parsed.success) {
			this.logger.warn({
				message: "Azure deployment list was not readable",
			});
			return null;
		}

		const models = parsed.data.data.flatMap((entry) => {
			const row = deployment.safeParse(entry);
			if (!row.success || !chatCapable(row.data)) return [];
			return [toCatalogModel(row.data.id, row.data.model ?? row.data.id)];
		});

		models.sort((a, b) => a.name.localeCompare(b.name));
		this.logger.log({
			message: "Azure model catalog loaded",
			models: models.length,
		});
		return models;
	}

	private async fetchV1Models(auth: {
		endpoint: string;
		apiKey: string;
	}): Promise<CatalogModel[] | null> {
		const url = `${auth.endpoint}/openai/v1/models`;
		const body = await this.getJson(url, auth.apiKey);
		if (!body) return null;

		const parsed = v1ModelList.safeParse(body);
		if (!parsed.success) {
			this.logger.warn({
				message: "Azure model list was not readable",
			});
			return null;
		}

		const models = parsed.data.data.flatMap((entry) => {
			const row = v1Model.safeParse(entry);
			return row.success ? [toCatalogModel(row.data.id, row.data.id)] : [];
		});

		models.sort((a, b) => a.name.localeCompare(b.name));
		this.logger.log({
			message: "Azure model catalog loaded",
			models: models.length,
		});
		return models;
	}

	private async getJson(url: string, apiKey: string): Promise<unknown | null> {
		try {
			const response = await fetch(url, {
				headers: { accept: "application/json", "api-key": apiKey },
				signal: AbortSignal.timeout(AZURE.catalog.timeoutMs),
			});

			if (!response.ok) {
				this.logger.warn({
					message: "Azure model catalog request failed",
					status: response.status,
				});
				return null;
			}

			return await response.json();
		} catch (error) {
			this.logger.warn({
				message: "Azure model catalog unavailable",
				reason: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}
}
