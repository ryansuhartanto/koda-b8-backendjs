import { Router } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import { defined } from "#/lib/row";
import { encode } from "#/lib/sqid";
import { auth } from "#/middleware/auth";
import type {
	Order,
	OrderItem,
	OrderItemRow,
	OrderRequest,
	OrderRow,
} from "#/model/order";

const columns = `
	id,
	created_at,
	status,
	payment_method,
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
	ship_note`;

// RFC3339 carries no fractional seconds, which is what keeps this identical to the Go service
function toOrder({ id, created_at, ...rest }: OrderRow): Omit<Order, "items"> {
	// rebuilt in column order so the JSON key order matches the Go service
	return {
		id,
		created_at: `${created_at.toISOString().slice(0, 19)}Z`,
		...defined(rest),
	};
}

function toOrderItem(row: OrderItemRow): OrderItem {
	const { id_order, id, id_variant, ...rest } = defined(row);

	// rebuilt in column order so the JSON key order matches the Go service
	return id_variant === undefined
		? { id, ...rest }
		: { id, id_variant: encode(id_variant), ...rest };
}

function toOrderRequest(body: unknown): OrderRequest | undefined {
	const raw = (body ?? {}) as Record<string, unknown>;
	const promoCode = raw["promo_code"] ?? "";
	const shipNote = raw["ship_note"] ?? "";

	if (
		!Number.isInteger(raw["id_address"]) ||
		typeof raw["payment_method"] !== "string" ||
		raw["payment_method"] === "" ||
		typeof raw["ship_method"] !== "string" ||
		raw["ship_method"] === "" ||
		typeof promoCode !== "string" ||
		typeof shipNote !== "string"
	) {
		return undefined;
	}

	return {
		id_address: raw["id_address"] as number,
		payment_method: raw["payment_method"],
		ship_method: raw["ship_method"],
		promo_code: promoCode,
		ship_note: shipNote,
	};
}

export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         id_variant: { type: string }
 *         product_name: { type: string }
 *         variant_name: { type: string }
 *         unit_price_idr: { type: integer }
 *         quantity: { type: integer }
 *       required: [id, product_name, quantity, unit_price_idr, variant_name]
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         created_at: { type: string }
 *         status: { type: string }
 *         payment_method: { type: string }
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
 *           { type: array, items: { $ref: "#/components/schemas/OrderItem" }, uniqueItems: false }
 *       required:
 *         [created_at, discount_idr, id, items, payment_method, ship_address,
 *          ship_cost_idr, ship_email, ship_method, ship_name, ship_phone,
 *          status, subtotal_idr, total_idr]
 *     OrderRequest:
 *       type: object
 *       properties:
 *         id_address: { type: integer }
 *         payment_method: { type: string }
 *         ship_method: { type: string }
 *         promo_code: { type: string }
 *         ship_note: { type: string }
 *       required: [id_address, payment_method, ship_method]
 *
 * /orders:
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
 *         description: No such address or shipping method
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
router.get("/orders", auth, async (req, res) => {
	try {
		const { rows } = await pool.query<OrderRow>(
			`SELECT ${columns}
			FROM orders_summary
			WHERE id_user = $1
			ORDER BY created_at DESC, id DESC`,
			[req.idUser],
		);

		const lines = await pool.query<OrderItemRow>(
			`SELECT
				id_order,
				id,
				id_variant,
				product_name,
				variant_name,
				unit_price_idr,
				quantity
			FROM order_items
			WHERE id_order = ANY($1)
			ORDER BY id`,
			[rows.map((order) => order.id)],
		);

		const orders: Order[] = [];

		for (const order of rows) {
			const items: OrderItem[] = [];

			for (const line of lines.rows) {
				if (line.id_order === order.id) {
					items.push(toOrderItem(line));
				}
			}

			orders.push(Object.assign(toOrder(order), { items }));
		}

		res.json(orders);
	} catch (error) {
		problem(res, 500, error);
	}
});

router.post("/orders", auth, async (req, res) => {
	const body = toOrderRequest(req.body);

	if (body === undefined) {
		problem(
			res,
			400,
			"id_address, payment_method and ship_method are required",
		);
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
			FROM saved_address_shipping
			WHERE id = $1 AND id_user = $2`,
			[body.id_address, req.idUser],
		);

		const [ship] = address.rows;

		if (ship === undefined) {
			await client.query("ROLLBACK");
			problem(res, 404, "no such address");
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
		// ordered by id so that two checkouts touching the same variants take the row locks in
		// the same sequence and cannot deadlock
		const cart = await client.query<{
			product_name: string;
			inventory: number;
			quantity: number;
		}>(
			`SELECT
				p.name AS product_name,
				pv.inventory,
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

		// the inventory CHECK names no product, so the readable 409 is raised here
		for (const line of cart.rows) {
			if (line.quantity > line.inventory) {
				await client.query("ROLLBACK");
				problem(res, 409, `not enough stock for ${line.product_name}`);
				return;
			}
		}

		// RETURNING cannot read a view, so the row is read back through orders_summary
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
			FROM cart_totals
			WHERE id_user = $1
			RETURNING id`,
			[
				req.idUser,
				body.payment_method,
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

		const summary = await client.query<OrderRow>(
			`SELECT ${columns} FROM orders_summary WHERE id = $1`,
			[row.id],
		);

		const [summaryRow] = summary.rows;

		if (summaryRow === undefined) {
			throw new Error("insert returned no row");
		}

		const order = toOrder(summaryRow);

		// data-modifying CTEs run to completion even though only `inserted` is selected from
		const inserted = await client.query<OrderItemRow>(
			`WITH cart AS MATERIALIZED (
				SELECT
					id_variant,
					name,
					name_variant,
					price_idr,
					quantity
				FROM cart_lines
				WHERE id_user = $2
			),
			inserted AS (
				INSERT INTO order_items (
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
					name_variant,
					price_idr,
					quantity
				FROM cart
				RETURNING
					id_order,
					id,
					id_variant,
					product_name,
					variant_name,
					unit_price_idr,
					quantity
			),
			stock AS (
				UPDATE products_variants pv SET inventory = pv.inventory - cart.quantity
				FROM cart WHERE cart.id_variant = pv.id
			),
			cleared AS (
				DELETE FROM cart_items WHERE id_user = $2
			)
			SELECT
				id_order,
				id,
				id_variant,
				product_name,
				variant_name,
				unit_price_idr,
				quantity
			FROM inserted
			ORDER BY id`,
			[order.id, req.idUser],
		);

		const items: OrderItem[] = inserted.rows.map(toOrderItem);

		await client.query("COMMIT");

		res.status(201).json({ ...defined(order), items });
	} catch (error) {
		await client.query("ROLLBACK");
		problem(res, 500, error);
	} finally {
		client.release();
	}
});
