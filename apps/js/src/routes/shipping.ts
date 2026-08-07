import { Router } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import type { ShippingMethod } from "#/model/shipping";

export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ShippingMethod:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         cost_idr: { type: integer }
 *       required: [cost_idr, id, name]
 *
 * /shipping-methods:
 *   get:
 *     summary: List shipping methods and their cost
 *     tags: [shipping]
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

		const methods: ShippingMethod[] = rows;

		res.json(methods);
	} catch (error) {
		problem(res, 500, error);
	}
});
