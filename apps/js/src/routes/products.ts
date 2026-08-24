import { Router } from "express";

import { pagination } from "#/lib/link";
import { intQuery, sqids } from "#/lib/params";
import { fail, problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";
import { wire } from "#/lib/wire";
import { admin, auth } from "#/middleware/auth";
import type { ProductRequest } from "#/model/product";
import * as products from "#/service/product";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 2147483647;

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

	if (typeof sort !== "string" || products.sorts[sort] === undefined) {
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

	try {
		const { products: rows, total } = await products.list({
			search: typeof search === "string" ? search : undefined,
			category: typeof category === "string" ? category : undefined,
			brand: typeof brand === "string" ? brand : undefined,
			sort,
			limit,
			offset,
		});

		pagination(req, res, total, limit, offset);
		res.json(wire(rows));
	} catch (error) {
		fail(res, error);
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

	try {
		res.status(201).json(wire(await products.create(body)));
	} catch (error) {
		fail(res, error);
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
		res.json(wire(await products.find(req.ids["id_product"]!)));
	} catch (error) {
		fail(res, error);
	}
});
