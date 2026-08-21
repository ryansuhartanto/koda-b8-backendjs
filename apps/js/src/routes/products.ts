import { Router } from "express";

import { pool } from "#/lib/db";
import { pagination } from "#/lib/link";
import { intQuery, sqids } from "#/lib/params";
import { problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";
import { wire } from "#/lib/wire";
import { admin, auth } from "#/middleware/auth";
import type { ProductRequest, ProductsSummary } from "#/model/product";

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

function intBody(raw: unknown, min: number): number | undefined {
	if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < min) {
		return undefined;
	}

	return raw;
}

function toProductRequest(body: unknown): ProductRequest | undefined {
	const raw = (body ?? {}) as Record<string, unknown>;
	const description = raw["description"] ?? "";
	const sku = raw["sku"] ?? "";
	const urls = raw["urls"] ?? [];
	const discount = raw["discount_price_idr"] ?? undefined;
	const stock = intBody(raw["stock"] ?? 0, 0);
	const originalPrice = intBody(raw["original_price_idr"], 1);
	const discountPrice =
		discount === undefined ? undefined : intBody(discount, 0);

	if (
		typeof raw["name"] !== "string" ||
		raw["name"] === "" ||
		typeof description !== "string" ||
		typeof sku !== "string" ||
		!Array.isArray(urls) ||
		urls.some((url) => typeof url !== "string" || url === "") ||
		stock === undefined ||
		originalPrice === undefined ||
		(discount !== undefined && discountPrice === undefined)
	) {
		return undefined;
	}

	// an unresolvable sqid trips the foreign key, which 404s
	return {
		name: raw["name"],
		description,
		id_category:
			typeof raw["id_category"] === "string"
				? (decode(raw["id_category"]) ?? -1)
				: undefined,
		id_brand:
			typeof raw["id_brand"] === "string"
				? (decode(raw["id_brand"]) ?? -1)
				: undefined,
		sku,
		stock,
		original_price_idr: originalPrice,
		discount_price_idr: discountPrice,
		urls: urls as string[],
	};
}

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
 *         description: Product name substring
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
 *         description: Sort order
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
 *             description: "RFC 8288 pagination links"
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
		// COUNT(*) OVER() carries the total on every row, so no second round trip
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
 * components:
 *   schemas:
 *     ProductRequest:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         description: { type: string }
 *         id_category: { type: string }
 *         id_brand: { type: string }
 *         sku: { type: string }
 *         stock: { type: integer }
 *         original_price_idr: { type: integer }
 *         discount_price_idr: { type: integer }
 *         urls: { type: array, items: { type: string }, uniqueItems: false }
 *       required: [name, original_price_idr]
 *
 * /products:
 *   post:
 *     summary: Create a product
 *     tags: [products]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       description: Product
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ProductRequest"
 *             summary: body
 *             description: Product
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Product" }
 *       "400":
 *         description: Invalid body
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "401":
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "403":
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "404":
 *         description: No such category or brand
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "409":
 *         description: Duplicate sku, or discount at or above the original price
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.post("/products", auth, admin, async (req, res) => {
	const body = toProductRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "name and a positive original_price_idr are required");
		return;
	}

	const client = await pool.connect();

	try {
		await client.query("BEGIN");

		const created = await client.query<{ id: number }>(
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
			[body.name, body.description, body.id_category, body.id_brand],
		);

		const [product] = created.rows;

		if (product === undefined) {
			throw new Error("insert returned no row");
		}

		// products_variants.price is vestigial: every view reads products_price instead
		const variant = await client.query<{ id: number }>(
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
			[product.id, body.sku, body.original_price_idr, body.stock],
		);

		const [row] = variant.rows;

		if (row === undefined) {
			throw new Error("insert returned no row");
		}

		await client.query(
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
			[row.id, body.original_price_idr, body.discount_price_idr],
		);

		// WITH ORDINALITY numbers the gallery, which is unique per product
		await client.query(
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
			[product.id, row.id, body.urls],
		);

		// RETURNING cannot read a view, so the product is read back through the summary
		const summary = await client.query<ProductsSummary>(
			`SELECT ${detail} FROM products_summary WHERE id = $1`,
			[product.id],
		);

		const [full] = summary.rows;

		if (full === undefined) {
			throw new Error("insert returned no row");
		}

		await client.query("COMMIT");

		res.status(201).json(wire(full));
	} catch (error) {
		await client.query("ROLLBACK");

		const { code } = error as { code?: string };

		if (code === "23503") {
			// foreign_key_violation
			problem(res, 404, "no such category or brand");
			return;
		}

		if (code === "23505") {
			// unique_violation
			problem(res, 409, "sku already exists");
			return;
		}

		if (code === "23514") {
			// check_violation
			problem(res, 409, "discount_price_idr must be below original_price_idr");
			return;
		}

		problem(res, 500, error);
	} finally {
		client.release();
	}
});

/**
 * @openapi
 * /products/{id_product}:
 *   get:
 *     summary: Fetch a product
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
