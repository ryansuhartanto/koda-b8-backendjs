import { Router } from "express";

import { pool } from "#/lib/db";
import { pagination } from "#/lib/link";
import { sqids } from "#/lib/params";
import { problem } from "#/lib/problem";
import { wire } from "#/lib/wire";
import type { ProductsSummary } from "#/model/product";

const sorts: Record<string, string> = {
	newest: "created_at DESC, id DESC",
	price_asc: "price_idr ASC, id ASC",
	price_desc: "price_idr DESC, id DESC",
	rating: "rating DESC NULLS LAST, id DESC",
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 2147483647;

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

function intQuery(
	raw: unknown,
	key: string,
	fallback: number,
	min: number,
	max: number,
): number {
	if (raw === undefined || raw === "") {
		return fallback;
	}

	const value = Number(raw);

	if (
		typeof raw !== "string" ||
		!/^-?\d+$/.test(raw) ||
		value < min ||
		value > max
	) {
		throw new RangeError(`${key} must be an integer between ${min} and ${max}`);
	}

	return value;
}

// TODO: admin writes for /products go here, against the base tables
export const router: Router = sqids(Router());

/**
 * @openapi
 * components:
 *   schemas:
 *     VariantOption:
 *       type: object
 *       properties:
 *         option: { type: string }
 *         value: { type: string }
 *       required: [option, value]
 *     ProductVariant:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         sku: { type: string }
 *         stock: { type: integer }
 *         price_idr: { type: integer }
 *         original_price_idr: { type: integer }
 *         options:
 *           type: array
 *           items: { $ref: "#/components/schemas/VariantOption" }
 *           uniqueItems: false
 *       required: [id, options, original_price_idr, price_idr, stock]
 *     Product:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         created_at: { type: string }
 *         updated_at: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         brand: { type: string }
 *         category: { type: string }
 *         urls: { type: array, items: { type: string }, uniqueItems: false }
 *         price_idr: { type: integer }
 *         original_price_idr: { type: integer }
 *         stock: { type: integer }
 *         rating: { type: number }
 *         rating_count: { type: integer }
 *         variants:
 *           type: array
 *           items: { $ref: "#/components/schemas/ProductVariant" }
 *           uniqueItems: false
 *       required: [created_at, id, name, rating_count, stock, updated_at]
 *
 * /products:
 *   get:
 *     summary: List products
 *     tags: [products]
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Match against the product name
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         description: Category name
 *         schema: { type: string }
 *       - in: query
 *         name: brand
 *         description: Brand name
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         description: One of newest, price_asc, price_desc, rating
 *         schema:
 *           type: string
 *           enum: [newest, price_asc, price_desc, rating]
 *       - in: query
 *         name: limit
 *         description: Rows to return, 1 to 100
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         description: Rows to skip
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       "200":
 *         description: OK
 *         headers:
 *           Link:
 *             description: "RFC 8288 pagination links: self, first, last, prev, next"
 *             schema: { type: string }
 *           X-Total-Count:
 *             description: Rows matching the filter, ignoring limit and offset
 *             schema: { type: integer }
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Product" } }
 *       "400":
 *         description: Invalid query
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/products", async (req, res) => {
	const { search, category, brand } = req.query;
	const sort = req.query["sort"] ?? "newest";

	if (typeof sort !== "string" || sorts[sort] === undefined) {
		problem(
			res,
			400,
			"sort must be one of newest, price_asc, price_desc, rating",
		);
		return;
	}

	let limit: number;
	let offset: number;

	try {
		limit = intQuery(req.query["limit"], "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
		offset = intQuery(req.query["offset"], "offset", 0, 0, MAX_OFFSET);
	} catch (error) {
		problem(res, 400, error);
		return;
	}

	const filters: string[] = [];
	const args: unknown[] = [];

	if (typeof search === "string" && search !== "") {
		args.push(search);
		filters.push(`name ILIKE '%' || $${args.length} || '%'`);
	}

	if (typeof category === "string" && category !== "") {
		args.push(category);
		filters.push(`category = $${args.length}`);
	}

	if (typeof brand === "string" && brand !== "") {
		args.push(brand);
		filters.push(`brand = $${args.length}`);
	}

	const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

	args.push(limit, offset);

	try {
		// COUNT(*) OVER() carries the unpaginated total on every row, avoiding a second round trip
		const { rows } = await pool.query<ProductsSummary & { total: string }>(
			`SELECT ${columns}, COUNT(*) OVER() AS total
			FROM products_summary
			${where} ORDER BY ${sorts[sort]} LIMIT $${args.length - 1} OFFSET $${args.length}`,
			args,
		);

		const products = rows.map(({ total: _total, ...row }) => row);

		pagination(req, res, Number(rows[0]?.total ?? 0), limit, offset);
		res.json(wire(products));
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /products/{id_product}:
 *   get:
 *     summary: Fetch one product and its variants
 *     tags: [products]
 *     parameters:
 *       - in: path
 *         name: id_product
 *         required: true
 *         description: Product sqid
 *         schema: { type: string }
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Product" }
 *       "404":
 *         description: No such product
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/products/:id_product", async (req, res) => {
	try {
		const { rows } = await pool.query<ProductsSummary>(
			`SELECT ${detail}
			FROM products_summary
			WHERE id = $1`,
			[req.ids["id_product"]],
		);

		const [row] = rows;

		if (row === undefined) {
			problem(res, 404, "no such product");
			return;
		}

		res.json(wire(row));
	} catch (error) {
		problem(res, 500, error);
	}
});
