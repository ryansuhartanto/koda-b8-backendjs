import { QueryTypes } from "@sequelize/core";

import { sequelize, sqlstate } from "#/lib/db";
import { HttpError } from "#/lib/problem";
import type { ProductRequest, ProductsSummary } from "#/model/product";

export const sorts: Record<string, string> = {
	newest: "created_at DESC, id DESC",
	price_asc: "price_idr ASC, id ASC",
	price_desc: "price_idr DESC, id DESC",
	rating: "rating DESC NULLS LAST, id DESC",
};

// the aggregated variants are heavy and a listing never renders them
const columns = `
	id, created_at, updated_at,
	name, description,
	brand, category,
	urls,
	price_idr, original_price_idr,
	stock,
	rating, rating_count`;

const detail = `${columns}, variants`;

export type ProductFilter = {
	search?: string;
	category?: string;
	brand?: string;
	sort: string;
	limit: number;
	offset: number;
};

export async function list(
	filter: ProductFilter,
): Promise<{ products: ProductsSummary[]; total: number }> {
	const filters: string[] = [];
	const bind: unknown[] = [];

	for (const [column, value] of [
		["name", filter.search],
		["category", filter.category],
		["brand", filter.brand],
	] as const) {
		if (value === undefined || value === "") {
			continue;
		}

		bind.push(value);
		filters.push(
			column === "name"
				? `name ILIKE '%' || $${bind.length} || '%'`
				: `${column} = $${bind.length}`,
		);
	}

	const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

	bind.push(filter.limit, filter.offset);

	// COUNT(*) OVER() carries the total on every row, so no second round trip
	const rows = await sequelize.query<ProductsSummary & { total: string }>(
		`SELECT ${columns}, COUNT(*) OVER() AS total
		FROM products_summary
		${where} ORDER BY ${sorts[filter.sort]} LIMIT $${bind.length - 1} OFFSET $${bind.length}`,
		{ type: QueryTypes.SELECT, bind },
	);

	return {
		products: rows.map(({ total: _total, ...row }) => row),
		total: Number(rows[0]?.total ?? 0),
	};
}

export async function find(id: number): Promise<ProductsSummary> {
	const row = await sequelize.query<ProductsSummary>(
		`SELECT ${detail}
		FROM products_summary
		WHERE id = $1`,
		{ type: QueryTypes.SELECT, plain: true, bind: [id] },
	);

	if (row === null) {
		throw new HttpError(404, "no such product");
	}

	return row;
}

export async function create(body: ProductRequest): Promise<ProductsSummary> {
	try {
		return await sequelize.transaction(async (transaction) => {
			const product = await sequelize.query<{ id: number }>(
				`INSERT INTO products (
					name,
					description,
					id_category,
					id_brand
				)
				VALUES (
					$1,
					NULLIF($2, ''),
					$3,
					$4
				)
				RETURNING id`,
				{
					type: QueryTypes.SELECT,
					plain: true,
					bind: [body.name, body.description, body.id_category, body.id_brand],
					transaction,
				},
			);

			if (product === null) {
				throw new Error("insert returned no row");
			}

			// products_variants.price is vestigial: every view reads products_price instead
			const variant = await sequelize.query<{ id: number }>(
				`INSERT INTO products_variants (
					id_product,
					sku,
					price,
					stock
				)
				VALUES (
					$1,
					NULLIF($2, ''),
					$3,
					$4
				)
				RETURNING id`,
				{
					type: QueryTypes.SELECT,
					plain: true,
					bind: [product.id, body.sku, body.original_price_idr, body.stock],
					transaction,
				},
			);

			if (variant === null) {
				throw new Error("insert returned no row");
			}

			await sequelize.query(
				`INSERT INTO products_price (
					id_variant,
					original_price_idr,
					discount_price_idr
				)
				VALUES (
					$1,
					$2,
					$3
				)`,
				{
					type: QueryTypes.INSERT,
					bind: [variant.id, body.original_price_idr, body.discount_price_idr],
					transaction,
				},
			);

			// WITH ORDINALITY numbers the gallery, which is unique per product
			await sequelize.query(
				`INSERT INTO products_images (
					id_product,
					id_variant,
					position,
					url
				)
				SELECT
					$1,
					$2,
					ordinality - 1,
					url
				FROM UNNEST($3::TEXT[]) WITH ORDINALITY AS image(url, ordinality)`,
				{
					type: QueryTypes.INSERT,
					bind: [product.id, variant.id, body.urls],
					transaction,
				},
			);

			// RETURNING cannot read a view, so the product is read back through the summary
			const full = await sequelize.query<ProductsSummary>(
				`SELECT ${detail} FROM products_summary WHERE id = $1`,
				{
					type: QueryTypes.SELECT,
					plain: true,
					bind: [product.id],
					transaction,
				},
			);

			if (full === null) {
				throw new Error("insert returned no row");
			}

			return full;
		});
	} catch (error) {
		switch (sqlstate(error)) {
			case "23503": // foreign_key_violation
				throw new HttpError(404, "no such category or brand");
			case "23505": // unique_violation
				throw new HttpError(409, "sku already exists");
			case "23514": // check_violation
				throw new HttpError(
					409,
					"discount_price_idr must be below original_price_idr",
				);
			default:
				throw error;
		}
	}
}
