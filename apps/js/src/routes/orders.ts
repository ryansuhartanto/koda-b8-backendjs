import { Router } from "express";

import { pagination } from "#/lib/link";
import { intQuery, sqids } from "#/lib/params";
import { fail, problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";
import { wire } from "#/lib/wire";
import { admin, auth } from "#/middleware/auth";
import type { OrderRequest, OrderStatus } from "#/model/order";
import * as orders from "#/service/order";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 2147483647;

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

	// identity columns start at 1, so an unresolvable sqid matches nothing and 404s
	return {
		id_address: decode(raw["id_address"]) ?? -1,
		id_payment: decode(raw["id_payment"]) ?? -1,
		ship_method: raw["ship_method"],
		promo_code: promoCode,
		ship_note: shipNote,
	};
}

function isStatus(value: unknown): value is OrderStatus {
	return typeof value === "string" && value in orders.transitions;
}

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
 *     summary: List own orders
 *     tags: [orders]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Order" } }
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
 *     summary: Check out
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
 *         description: Invalid token
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
/**
 * @openapi
 * components:
 *   schemas:
 *     OrderStatusRequest:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, packed, shipped, delivered, cancelled]
 *       required: [status]
 *
 * /orders:
 *   get:
 *     summary: List orders
 *     tags: [orders]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         description: Order status
 *         schema:
 *           type: string
 *           enum: [pending, packed, shipped, delivered, cancelled]
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
 *             schema: { type: array, items: { $ref: "#/components/schemas/Order" } }
 *       "400":
 *         description: Invalid query
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
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/orders", auth, admin, async (req, res) => {
	const { status } = req.query;

	if (status !== undefined && !isStatus(status)) {
		problem(
			res,
			400,
			"status must be one of pending, packed, shipped, delivered, cancelled",
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
		const { orders: rows, total } = await orders.list({
			status,
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
 * /orders/{id_order}:
 *   patch:
 *     summary: Update order status
 *     tags: [orders]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_order
 *         required: true
 *         description: Order sqid
 *         schema: { type: string }
 *     requestBody:
 *       description: Status
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/OrderStatusRequest"
 *             summary: body
 *             description: Status
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Order" }
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
 *         description: No such order
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "409":
 *         description: Disallowed transition
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.patch("/orders/:id_order", auth, admin, async (req, res) => {
	const next = ((req.body ?? {}) as Record<string, unknown>)["status"];

	if (!isStatus(next)) {
		problem(
			res,
			400,
			"status must be one of pending, packed, shipped, delivered, cancelled",
		);
		return;
	}

	try {
		const order = await orders.advance(req.ids["id_order"]!, next);

		res.json(wire(order));
	} catch (error) {
		fail(res, error);
	}
});

router.get("/me/orders", auth, async (req, res) => {
	try {
		res.json(wire(await orders.listOwn(req.idUser)));
	} catch (error) {
		fail(res, error);
	}
});

router.post("/me/orders", auth, async (req, res) => {
	const body = toOrderRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "id_address, id_payment and ship_method are required");
		return;
	}

	try {
		res.status(201).json(wire(await orders.checkout(req.idUser, body)));
	} catch (error) {
		fail(res, error);
	}
});
