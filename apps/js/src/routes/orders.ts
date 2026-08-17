import { Router } from "express";

import { pool } from "#/lib/db";
import { sqids } from "#/lib/params";
import { problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
import type { OrderRequest, OrdersSummary } from "#/model/order";

const columns = `
	id,
	created_at,
	status,
	id_payment,
	promo_code,
	discount_idr,
	subtotal_idr,
	ship_cost_idr,
	total_idr,
	ship_name,
	ship_phone,
	ship_email,
	ship_address,
	ship_method,
	ship_note,
	items`;

function toOrderRequest(body: unknown): OrderRequest | undefined {
	const raw = (body ?? {}) as Record<string, unknown>;
	const promoCode = raw["promo_code"] ?? "";
	const shipNote = raw["ship_note"] ?? "";

	if (
		typeof raw["id_address"] !== "string" ||
		typeof raw["id_payment"] !== "string" ||
		typeof raw["ship_method"] !== "string" ||
		raw["ship_method"] === "" ||
		typeof promoCode !== "string" ||
		typeof shipNote !== "string"
	) {
		return undefined;
	}

	// identity columns start at 1, so an unresolvable sqid resolves to nothing and 404s
	return {
		id_address: decode(raw["id_address"]) ?? -1,
		id_payment: decode(raw["id_payment"]) ?? -1,
		ship_method: raw["ship_method"],
		promo_code: promoCode,
		ship_note: shipNote,
	};
}

// TODO: admin GET and PATCH /orders go here; /me/orders holds the caller's own
export const router: Router = sqids(Router());

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         id_variant: { type: string }
 *         product_name: { type: string }
 *         variant_name: { type: string }
 *         unit_price_idr: { type: integer }
 *         quantity: { type: integer }
 *       required: [id, product_name, quantity, unit_price_idr]
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         created_at: { type: string }
 *         status:
 *           type: string
 *           enum: [pending, packed, shipped, delivered, cancelled]
 *         id_payment: { type: string }
 *         promo_code: { type: string }
 *         discount_idr: { type: integer }
 *         subtotal_idr: { type: integer }
 *         ship_cost_idr: { type: integer }
 *         total_idr: { type: integer }
 *         ship_name: { type: string }
 *         ship_phone: { type: string }
 *         ship_email: { type: string }
 *         ship_address: { type: string }
 *         ship_method: { type: string }
 *         ship_note: { type: string }
 *         items:
 *           type: array
 *           items: { $ref: "#/components/schemas/OrderItem" }
 *           uniqueItems: false
 *       required:
 *         [created_at, discount_idr, id, id_payment, items, ship_address,
 *          ship_cost_idr, ship_email, ship_method, ship_name, ship_phone,
 *          status, subtotal_idr, total_idr]
 *     OrderRequest:
 *       type: object
 *       properties:
 *         id_address: { type: string }
 *         id_payment: { type: string }
 *         ship_method: { type: string }
 *         promo_code: { type: string }
 *         ship_note: { type: string }
 *       required: [id_address, id_payment, ship_method]
 *
 * /me/orders:
 *   get:
 *     summary: List the caller's orders, newest first
 *     tags: [orders]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Order" } }
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
 *     summary: Turn the caller's cart into an order
 *     tags: [orders]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       description: Checkout
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/OrderRequest"
 *             summary: body
 *             description: Checkout
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Order" }
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
 *         description: No such address, payment method or shipping method
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "409":
 *         description: Empty cart or insufficient stock
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/me/orders", auth, async (req, res) => {
	try {
		const { rows } = await pool.query<OrdersSummary>(
			`SELECT ${columns}
			FROM orders_summary
			WHERE id_user = $1
			ORDER BY created_at DESC, id DESC`,
			[req.idUser],
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});

router.post("/me/orders", auth, async (req, res) => {
	const body = toOrderRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "id_address, id_payment and ship_method are required");
		return;
	}

	const client = await pool.connect();

	try {
		await client.query("BEGIN");

		const address = await client.query<{
			name: string;
			phone: string;
			email: string;
			address: string;
		}>(
			`SELECT
				name,
				phone,
				email,
				address
			FROM users_address_shipping
			WHERE id = $1 AND id_user = $2`,
			[body.id_address, req.idUser],
		);

		const [ship] = address.rows;

		if (ship === undefined) {
			await client.query("ROLLBACK");
			problem(res, 404, "no such address");
			return;
		}

		const payment = await client.query(
			`SELECT
				id
			FROM payment_methods
			WHERE id = $1 AND is_available AND deleted_at IS NULL`,
			[body.id_payment],
		);

		if (payment.rowCount === 0) {
			await client.query("ROLLBACK");
			problem(res, 404, "no such payment method");
			return;
		}

		const method = await client.query<{ cost_idr: number }>(
			`SELECT
				cost_idr
			FROM shipping_methods
			WHERE name = $1 AND deleted_at IS NULL`,
			[body.ship_method],
		);

		const [shipping] = method.rows;

		if (shipping === undefined) {
			await client.query("ROLLBACK");
			problem(res, 404, "no such shipping method");
			return;
		}

		// base tables rather than cart_lines, since FOR UPDATE cannot target a view's join
		// ordered by id so concurrent checkouts take the locks in the same sequence
		const cart = await client.query<{
			product_name: string;
			stock: number;
			quantity: number;
		}>(
			`SELECT
				p.name AS product_name,
				pv.stock,
				ci.quantity
			FROM cart_items ci
			JOIN products_variants pv ON pv.id = ci.id_variant AND pv.deleted_at IS NULL
			JOIN products p ON p.id = pv.id_product AND p.deleted_at IS NULL
			WHERE ci.id_user = $1
			ORDER BY pv.id
			FOR UPDATE OF pv`,
			[req.idUser],
		);

		if (cart.rows.length === 0) {
			await client.query("ROLLBACK");
			problem(res, 409, "cart is empty");
			return;
		}

		// the stock CHECK names no product, so the readable 409 is raised here
		for (const line of cart.rows) {
			if (line.quantity > line.stock) {
				await client.query("ROLLBACK");
				problem(res, 409, `not enough stock for ${line.product_name}`);
				return;
			}
		}

		const created = await client.query<{ id: number }>(
			`INSERT INTO orders (
				id_user,
				payment_method,
				promo_code,
				discount_idr,
				subtotal_idr,
				ship_cost_idr,
				ship_name,
				ship_phone,
				ship_email,
				ship_address,
				ship_method,
				ship_note
			)
			SELECT
				$1,
				$2,
				NULLIF($3, ''),
				0,
				subtotal_idr,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				NULLIF($10, '')
			FROM cart_summary
			WHERE id_user = $1
			RETURNING id`,
			[
				req.idUser,
				body.id_payment,
				body.promo_code,
				shipping.cost_idr,
				ship.name,
				ship.phone,
				ship.email,
				ship.address,
				body.ship_method,
				body.ship_note,
			],
		);

		const [row] = created.rows;

		if (row === undefined) {
			throw new Error("insert returned no row");
		}

		// data-modifying CTEs run to completion even though nothing is selected from them
		await client.query(
			`WITH cart AS MATERIALIZED (
				SELECT
					id_variant,
					name,
					variant_name,
					price_idr,
					quantity
				FROM cart_lines
				WHERE id_user = $2
			),
			inserted AS (
				INSERT INTO orders_items (
					id_order,
					id_variant,
					product_name,
					variant_name,
					unit_price_idr,
					quantity
				)
				SELECT
					$1,
					id_variant,
					name,
					variant_name,
					price_idr,
					quantity
				FROM cart
			),
			stock AS (
				UPDATE products_variants pv SET stock = pv.stock - cart.quantity
				FROM cart WHERE cart.id_variant = pv.id
			)
			DELETE FROM cart_items WHERE id_user = $2`,
			[row.id, req.idUser],
		);

		// RETURNING cannot read a view, so the finished order is read back through the summary
		const summary = await client.query<OrdersSummary>(
			`SELECT ${columns} FROM orders_summary WHERE id = $1`,
			[row.id],
		);

		const [order] = summary.rows;

		if (order === undefined) {
			throw new Error("insert returned no row");
		}

		await client.query("COMMIT");

		res.status(201).json(wire(order));
	} catch (error) {
		await client.query("ROLLBACK");
		problem(res, 500, error);
	} finally {
		client.release();
	}
});
