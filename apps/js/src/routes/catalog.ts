import { Router } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import { wire } from "#/lib/wire";
import type {
	BrandsSummary,
	CategoriesSummary,
	PaymentMethod,
	ShippingMethod,
} from "#/model/catalog";

// TODO: admin POST and PATCH for /categories and /brands go here
export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         icon: { type: string }
 *         img: { type: string }
 *         product_count: { type: integer }
 *       required: [id, name, product_count]
 *     Brand:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         product_count: { type: integer }
 *       required: [id, name, product_count]
 *     ShippingMethod:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         cost_idr: { type: integer }
 *       required: [cost_idr, id, name]
 *     PaymentMethod:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         metadata: { type: object }
 *       required: [id, metadata, name]
 *
 * /categories:
 *   get:
 *     summary: List categories and how many products each holds
 *     tags: [catalog]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Category" } }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/categories", async (_req, res) => {
	try {
		const { rows } = await pool.query<CategoriesSummary>(
			`SELECT
				id,
				name,
				icon,
				img,
				product_count
			FROM categories_summary
			ORDER BY name`,
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /brands:
 *   get:
 *     summary: List brands and how many products each holds
 *     tags: [catalog]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Brand" } }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/brands", async (_req, res) => {
	try {
		const { rows } = await pool.query<BrandsSummary>(
			`SELECT
				id,
				name,
				product_count
			FROM brands_summary
			ORDER BY name`,
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /shipping-methods:
 *   get:
 *     summary: List shipping methods and their cost
 *     tags: [catalog]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               { type: array, items: { $ref: "#/components/schemas/ShippingMethod" } }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/shipping-methods", async (_req, res) => {
	try {
		const { rows } = await pool.query<ShippingMethod>(
			`SELECT
				id,
				name,
				cost_idr
			FROM shipping_methods
			WHERE deleted_at IS NULL
			ORDER BY cost_idr, id`,
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /payment-methods:
 *   get:
 *     summary: List the payment methods an order can be placed with
 *     tags: [catalog]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               { type: array, items: { $ref: "#/components/schemas/PaymentMethod" } }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/payment-methods", async (_req, res) => {
	try {
		const { rows } = await pool.query<PaymentMethod>(
			`SELECT
				id,
				name,
				metadata
			FROM payment_methods
			WHERE is_available AND deleted_at IS NULL
			ORDER BY name`,
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});
