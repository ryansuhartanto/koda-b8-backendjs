import { Router } from "express";

import { fail } from "#/lib/problem";
import { wire } from "#/lib/wire";
import * as catalog from "#/service/catalog";

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
 *     summary: List categories
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
		res.json(wire(await catalog.categories()));
	} catch (error) {
		fail(res, error);
	}
});

/**
 * @openapi
 * /brands:
 *   get:
 *     summary: List brands
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
		res.json(wire(await catalog.brands()));
	} catch (error) {
		fail(res, error);
	}
});

/**
 * @openapi
 * /shipping-methods:
 *   get:
 *     summary: List shipping methods
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
		res.json(wire(await catalog.shippingMethods()));
	} catch (error) {
		fail(res, error);
	}
});

/**
 * @openapi
 * /payment-methods:
 *   get:
 *     summary: List payment methods
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
		res.json(wire(await catalog.paymentMethods()));
	} catch (error) {
		fail(res, error);
	}
});
