import { Router } from "express";

import { pool } from "#/lib/db";
import { sqids } from "#/lib/params";
import { problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
import type { CartRequest, CartSummary } from "#/model/cart";

const empty: CartSummary = { subtotal_idr: 0, items: [] };

function toCartRequest(body: unknown): CartRequest | undefined {
	const { id_variant, quantity } = (body ?? {}) as Record<string, unknown>;

	if (typeof id_variant !== "string" || !Number.isInteger(quantity)) {
		return undefined;
	}

	if ((quantity as number) < 1) {
		return undefined;
	}

	// identity columns start at 1, so an unresolvable sqid resolves to nothing and 404s
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
 *     summary: The caller's cart and its subtotal
 *     tags: [cart]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Cart" }
 *       "401":
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *   post:
 *     summary: Set the quantity of one cart line
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
 *         description: Missing or invalid token
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
		const { rows } = await pool.query<CartSummary>(
			`SELECT
				subtotal_idr,
				items
			FROM cart_summary
			WHERE id_user = $1`,
			[req.idUser],
		);

		// the view groups cart_items, so an empty cart has no row at all
		res.json(wire(rows[0] ?? empty));
	} catch (error) {
		problem(res, 500, error);
	}
});

router.post("/me/cart", auth, async (req, res) => {
	const body = toCartRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "id_variant and a quantity of at least 1 are required");
		return;
	}

	try {
		// SELECT rather than a literal id: no check-then-insert window on a soft-deleted variant
		const { rowCount } = await pool.query(
			`INSERT INTO cart_items (
				id_user,
				id_variant,
				quantity
			)
			SELECT
				$1,
				id,
				$3
			FROM products_variants_sellable
			WHERE id = $2
			ON CONFLICT (id_user, id_variant) DO UPDATE SET quantity = EXCLUDED.quantity`,
			[req.idUser, body.id_variant, body.quantity],
		);

		if (rowCount === 0) {
			problem(res, 404, "no such variant");
			return;
		}

		res.sendStatus(204);
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /me/cart/{id_variant}:
 *   delete:
 *     summary: Remove one variant from the cart
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
 *         description: Missing or invalid token
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
		const { rowCount } = await pool.query(
			`DELETE FROM cart_items
			WHERE id_user = $1 AND id_variant = $2`,
			[req.idUser, req.ids["id_variant"]],
		);

		if (rowCount === 0) {
			problem(res, 404, "no such cart item");
			return;
		}

		res.sendStatus(204);
	} catch (error) {
		problem(res, 500, error);
	}
});
