import { Router } from "express";

import { sqids } from "#/lib/params";
import { fail, problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
import type { CartRequest } from "#/model/cart";
import * as cart from "#/service/cart";

function toCartRequest(body: unknown): CartRequest | undefined {
	const { id_variant, quantity } = (body ?? {}) as Record<string, unknown>;

	if (typeof id_variant !== "string" || !Number.isInteger(quantity)) {
		return undefined;
	}

	if ((quantity as number) < 1) {
		return undefined;
	}

	// identity columns start at 1, so an unresolvable sqid matches nothing and 404s
	return { id_variant: decode(id_variant) ?? -1, quantity: quantity as number };
}

export const router: Router = sqids(Router());

/**
 * @openapi
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       properties:
 *         id_variant: { type: string }
 *         id_product: { type: string }
 *         name: { type: string }
 *         variant_options:
 *           type: array
 *           items: { $ref: "#/components/schemas/VariantOption" }
 *           uniqueItems: false
 *         sku: { type: string }
 *         urls: { type: array, items: { type: string }, uniqueItems: false }
 *         price_idr: { type: integer }
 *         original_price_idr: { type: integer }
 *         inventory: { type: integer }
 *         quantity: { type: integer }
 *         created_at: { type: string }
 *       required:
 *         [created_at, id_product, id_variant, inventory, name,
 *          original_price_idr, price_idr, quantity]
 *     Cart:
 *       type: object
 *       properties:
 *         subtotal_idr: { type: integer }
 *         items:
 *           type: array
 *           items: { $ref: "#/components/schemas/CartItem" }
 *           uniqueItems: false
 *       required: [items, subtotal_idr]
 *     CartRequest:
 *       type: object
 *       properties:
 *         id_variant: { type: string }
 *         quantity: { type: integer, minimum: 1 }
 *       required: [id_variant, quantity]
 *
 * /me/cart:
 *   get:
 *     summary: Fetch the cart
 *     tags: [cart]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Cart" }
 *       "401":
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *   post:
 *     summary: Set a cart line quantity
 *     tags: [cart]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       description: Line
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CartRequest"
 *             summary: body
 *             description: Line
 *     responses:
 *       "204":
 *         description: No Content
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
 *       "404":
 *         description: No such variant
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/me/cart", auth, async (req, res) => {
	try {
		res.json(wire(await cart.summary(req.idUser)));
	} catch (error) {
		fail(res, error);
	}
});

router.post("/me/cart", auth, async (req, res) => {
	const body = toCartRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "id_variant and a quantity of at least 1 are required");
		return;
	}

	try {
		await cart.set(req.idUser, body);
		res.sendStatus(204);
	} catch (error) {
		fail(res, error);
	}
});

/**
 * @openapi
 * /me/cart/{id_variant}:
 *   delete:
 *     summary: Remove a cart line
 *     tags: [cart]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_variant
 *         required: true
 *         description: Variant sqid
 *         schema: { type: string }
 *     responses:
 *       "204":
 *         description: No Content
 *       "401":
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "404":
 *         description: No such cart item
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.delete("/me/cart/:id_variant", auth, async (req, res) => {
	try {
		await cart.remove(req.idUser, req.ids["id_variant"]!);
		res.sendStatus(204);
	} catch (error) {
		fail(res, error);
	}
});
