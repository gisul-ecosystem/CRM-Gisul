import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	productCreateInput,
	productDisplayInput,
	productDisplayOutput,
	productIdInput,
	productListInput,
	productListOutput,
	productMetaOutput,
	productOptionsOutput,
	productRowOutput,
	productUpdateInput,
} from "./products.contracts";
import { ProductsService } from "./products.service";

@Router({ alias: "products" })
@UseMiddlewares(AuthMiddleware)
export class ProductsRouter {
	constructor(
		@Inject(ProductsService) private readonly products: ProductsService,
	) {}

	@Query({
		output: productMetaOutput,
		meta: restMeta("GET", "/products/meta", ["Products"]),
	})
	meta() {
		return this.products.meta();
	}

	@Query({
		input: productListInput,
		output: productListOutput,
		meta: restMeta("GET", "/products", ["Products"]),
	})
	list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof productListInput>,
	) {
		return this.products.list(ctx.user.id, input);
	}

	@Query({
		output: productOptionsOutput,
		meta: restMeta("GET", "/products/options", ["Products"]),
	})
	options() {
		return this.products.options();
	}

	@Query({
		output: productDisplayOutput,
		meta: restMeta("GET", "/products/display", ["Products"]),
	})
	display(@Ctx() ctx: AuthedTrpcContext) {
		return this.products.display(ctx.user.id);
	}

	@Mutation({
		input: productDisplayInput,
		output: productDisplayOutput,
		meta: restMeta("PATCH", "/products/display", ["Products"]),
	})
	updateDisplay(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof productDisplayInput>,
	) {
		return this.products.updateDisplay(ctx.user.id, input);
	}

	@Mutation({
		input: productCreateInput,
		output: productRowOutput,
		meta: restMeta("POST", "/products", ["Products"]),
	})
	create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof productCreateInput>,
	) {
		return this.products.create(ctx.user.id, input);
	}

	@Mutation({
		input: productUpdateInput,
		output: productRowOutput,
		meta: restMeta("PATCH", "/products/{id}", ["Products"]),
	})
	update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof productUpdateInput>,
	) {
		return this.products.update(ctx.user.id, input);
	}

	@Mutation({
		input: productIdInput,
		output: productIdInput,
		meta: restMeta("DELETE", "/products/{id}", ["Products"]),
	})
	archive(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof productIdInput>,
	) {
		return this.products.archive(ctx.user.id, input.id);
	}
}
