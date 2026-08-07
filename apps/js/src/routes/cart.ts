import { Router } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import { defined } from "#/lib/row";
import { decode, encode, productPath } from "#/lib/sqid";
import { auth } from "#/middleware/auth";
import type { CartItem, CartItemRow, CartRequest } from "#/model/cart";

function toCartItem({
	id_variant,
	id_product,
	...rest
}: CartItemRow): CartItem {
	return {
		id_variant: encode(id_variant),
		path: productPath(encode(id_product), rest.name),
		...defined(rest),
	};
}

function toCartRequest(body: unknown): CartRequest | undefined {
	const { id_variant, quantity } = (body ?? {}) as Record<string, unknown>;

	if (
		typeof id_variant !== "string" ||
		id_variant === "" ||
		!Number.isInteger(quantity) ||
		(quantity as number) < 1
	) {
		return undefined;
	}

	return { id_variant, quantity: quantity as number };
}

export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       properties:
 *         id_variant: { type: string }
 *         path: { type: string }
 *         name: { type: string }
 *         name_variant: { type: string }
 *         img: { type: string }
 *         price_idr: { type: integer }
 *         original_price_idr: { type: integer }
 *         quantity: { type: integer }
 *       required:
 *         [id_variant, name, name_variant,
 *          original_price_idr, path, price_idr, quantity]
 *     CartRequest:
 *       type: object
 *       properties:
 *         id_variant: { type: string }
 *         quantity: { type: integer, minimum: 1 }
 *       required: [id_variant, quantity]
 *
 * /cart:
 *   get:
 *     summary: List the caller's cart
 *     tags: [cart]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/CartItem" } }
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
router.get("/cart", auth, async (req, res) => {
	try {
		const { rows } = await pool.query<CartItemRow>(
			`SELECT id_variant, id_product, name, name_variant,
				img,
				price_idr, original_price_idr, quantity
			FROM cart_lines
			WHERE id_user = $1
			ORDER BY created_at, id_variant`,
			[req.idUser],
		);

		const items: CartItem[] = rows.map(toCartItem);

		res.json(items);
	} catch (error) {
		problem(res, 500, error);
	}
});

router.post("/cart", auth, async (req, res) => {
	const body = toCartRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "id_variant and a quantity of at least 1 are required");
		return;
	}

	const idVariant = decode(body.id_variant);

	if (idVariant === undefined) {
		problem(res, 404, "no such variant");
		return;
	}

	try {
		// SELECT rather than a literal id, so a soft-deleted variant is rejected with no
		// check-then-insert window
		const { rowCount } = await pool.query(
			`INSERT INTO cart_items (id_user, id_variant, quantity)
			SELECT $1, id, $3
			FROM products_variants_sellable
			WHERE id = $2
			ON CONFLICT (id_user, id_variant) DO UPDATE SET quantity = EXCLUDED.quantity`,
			[req.idUser, idVariant, body.quantity],
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
 * /cart/{id_variant}:
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
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.delete("/cart/:id_variant", auth, async (req, res) => {
	const raw = req.params["id_variant"];
	const idVariant = decode(typeof raw === "string" ? raw : "");

	// no 400 branch, because removing something that cannot exist is still a removal
	if (idVariant === undefined) {
		res.sendStatus(204);
		return;
	}

	try {
		// no 404 branch, because DELETE is idempotent
		await pool.query(
			"DELETE FROM cart_items WHERE id_user = $1 AND id_variant = $2",
			[req.idUser, idVariant],
		);

		res.sendStatus(204);
	} catch (error) {
		problem(res, 500, error);
	}
});
