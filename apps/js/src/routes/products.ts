import { Router } from "express";

import { pool } from "#/lib/db";
import { pagination } from "#/lib/link";
import { problem } from "#/lib/problem";
import { defined } from "#/lib/row";
import { slugify } from "#/lib/slug";
import { decode, encode, productPath } from "#/lib/sqid";
import type {
	Product,
	ProductRow,
	ProductVariant,
	ProductVariantRow,
} from "#/model/product";

const sorts: Record<string, string> = {
	newest: "created_at DESC, id DESC",
	price_asc: "price_idr ASC, id ASC",
	price_desc: "price_idr DESC, id DESC",
	rating: "rating DESC NULLS LAST, id DESC",
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 2147483647;

// price, stock and rating all live one table away from products, so each is folded to a single row per product
const columns = `
	id, name, description,
	brand, category,
	img,
	price_idr, original_price_idr,
	inventory,
	rating, rating_count`;

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

function toProduct({ id, ...rest }: ProductRow): Product {
	const sqid = encode(id);

	return { id: sqid, path: productPath(sqid, rest.name), ...defined(rest) };
}

function toVariant({ id, ...rest }: ProductVariantRow): ProductVariant {
	return { id: encode(id), ...defined(rest) };
}

export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ProductVariant:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         inventory: { type: integer }
 *         price_idr: { type: integer }
 *         original_price_idr: { type: integer }
 *       required: [id, inventory, name, original_price_idr, price_idr]
 *     Product:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         path: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         brand: { type: string }
 *         category: { type: string }
 *         img: { type: string }
 *         price_idr: { type: integer }
 *         original_price_idr: { type: integer }
 *         inventory: { type: integer }
 *         rating: { type: number }
 *         rating_count: { type: integer }
 *         variants:
 *           type: array
 *           items: { $ref: "#/components/schemas/ProductVariant" }
 *           uniqueItems: false
 *       required:
 *         [id, inventory, name, original_price_idr, path, price_idr, rating_count]
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
		const { rows } = await pool.query<ProductRow & { total: string }>(
			`SELECT ${columns}, COUNT(*) OVER() AS total
			FROM products_summary
			${where} ORDER BY ${sorts[sort]} LIMIT $${args.length - 1} OFFSET $${args.length}`,
			args,
		);

		const products: Product[] = rows.map(({ total: _total, ...row }) =>
			toProduct(row),
		);

		pagination(req, res, Number(rows[0]?.total ?? 0), limit, offset);
		res.json(products);
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /products/{sqid}/{slug}:
 *   get:
 *     summary: Fetch one product
 *     tags: [products]
 *     parameters:
 *       - in: path
 *         name: sqid
 *         required: true
 *         description: Product sqid
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         description: Decorative slug, ignored when resolving and corrected by redirect
 *         schema: { type: string }
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Product" }
 *       "302":
 *         description: Slug is absent or stale
 *         content:
 *           application/json:
 *             schema: { type: string }
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
async function productBySqid(
	rawSqid: string,
	rawSlug: string,
	res: Parameters<Parameters<Router["get"]>[1]>[1],
): Promise<void> {
	const id = decode(rawSqid);

	if (id === undefined) {
		problem(res, 404, "no such product");
		return;
	}

	try {
		const { rows } = await pool.query<ProductRow>(
			`SELECT ${columns}
			FROM products_summary
			WHERE id = $1`,
			[id],
		);

		const [row] = rows;

		if (row === undefined) {
			problem(res, 404, "no such product");
			return;
		}

		const product = toProduct(row);

		if (rawSlug !== slugify(product.name)) {
			res.redirect(302, product.path);
			return;
		}

		const { rows: variants } = await pool.query<ProductVariantRow>(
			`SELECT id, name, description, inventory, price_idr, original_price_idr
			FROM products_variants_priced
			WHERE id_product = $1
			ORDER BY position ASC, id ASC`,
			[id],
		);

		product.variants = variants.map(toVariant);

		res.json(product);
	} catch (error) {
		problem(res, 500, error);
	}
}

router.get("/products/:sqid", async (req, res) => {
	await productBySqid(req.params.sqid, "", res);
});

router.get("/products/:sqid/*slug", async (req, res) => {
	const raw = (req.params as Record<string, string | string[]>)["slug"];

	await productBySqid(
		req.params.sqid,
		Array.isArray(raw) ? raw.join("/") : (raw ?? ""),
		res,
	);
});
