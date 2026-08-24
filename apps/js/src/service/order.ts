import { QueryTypes } from "@sequelize/core";

import { sequelize } from "#/lib/db";
import { HttpError } from "#/lib/problem";
import type { OrderRequest, OrderStatus, OrdersSummary } from "#/model/order";

// an order only moves forward, and stops at delivered or cancelled
export const transitions: Record<OrderStatus, OrderStatus[]> = {
	pending: ["packed", "cancelled"],
	packed: ["shipped", "cancelled"],
	shipped: ["delivered"],
	delivered: [],
	cancelled: [],
};

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

export type OrderFilter = {
	status?: OrderStatus;
	limit: number;
	offset: number;
};

export async function list(
	filter: OrderFilter,
): Promise<{ orders: OrdersSummary[]; total: number }> {
	const bind: unknown[] = [];
	let where = "";

	if (filter.status !== undefined) {
		bind.push(filter.status);
		where = `WHERE status = $${bind.length}`;
	}

	bind.push(filter.limit, filter.offset);

	// COUNT(*) OVER() carries the total on every row, so no second round trip
	const rows = await sequelize.query<OrdersSummary & { total: string }>(
		`SELECT ${columns}, COUNT(*) OVER() AS total
		FROM orders_summary
		${where} ORDER BY created_at DESC, id DESC
		LIMIT $${bind.length - 1} OFFSET $${bind.length}`,
		{ type: QueryTypes.SELECT, bind },
	);

	return {
		orders: rows.map(({ total: _total, ...row }) => row),
		total: Number(rows[0]?.total ?? 0),
	};
}

export async function listOwn(idUser: number): Promise<OrdersSummary[]> {
	return sequelize.query<OrdersSummary>(
		`SELECT ${columns}
		FROM orders_summary
		WHERE id_user = $1
		ORDER BY created_at DESC, id DESC`,
		{ type: QueryTypes.SELECT, bind: [idUser] },
	);
}

export async function advance(
	id: number,
	next: OrderStatus,
): Promise<OrdersSummary> {
	return sequelize.transaction(async (transaction) => {
		// locked so two admins cannot both read the same status and both advance it
		const order = await sequelize.query<{ status: OrderStatus }>(
			`SELECT status FROM orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
			{ type: QueryTypes.SELECT, plain: true, bind: [id], transaction },
		);

		if (order === null) {
			throw new HttpError(404, "no such order");
		}

		if (!transitions[order.status].includes(next)) {
			throw new HttpError(
				409,
				`cannot move an order from ${order.status} to ${next}`,
			);
		}

		await sequelize.query(`UPDATE orders SET status = $1 WHERE id = $2`, {
			type: QueryTypes.UPDATE,
			bind: [next, id],
			transaction,
		});

		const updated = await sequelize.query<OrdersSummary>(
			`SELECT ${columns} FROM orders_summary WHERE id = $1`,
			{ type: QueryTypes.SELECT, plain: true, bind: [id], transaction },
		);

		if (updated === null) {
			throw new Error("update returned no row");
		}

		return updated;
	});
}

export async function checkout(
	idUser: number,
	body: OrderRequest,
): Promise<OrdersSummary> {
	return sequelize.transaction(async (transaction) => {
		const ship = await sequelize.query<{
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
			{
				type: QueryTypes.SELECT,
				plain: true,
				bind: [body.id_address, idUser],
				transaction,
			},
		);

		if (ship === null) {
			throw new HttpError(404, "no such address");
		}

		const payment = await sequelize.query(
			`SELECT
				id
			FROM payment_methods
			WHERE id = $1 AND is_available AND deleted_at IS NULL`,
			{
				type: QueryTypes.SELECT,
				plain: true,
				bind: [body.id_payment],
				transaction,
			},
		);

		if (payment === null) {
			throw new HttpError(404, "no such payment method");
		}

		const shipping = await sequelize.query<{ cost_idr: number }>(
			`SELECT
				cost_idr
			FROM shipping_methods
			WHERE name = $1 AND deleted_at IS NULL`,
			{
				type: QueryTypes.SELECT,
				plain: true,
				bind: [body.ship_method],
				transaction,
			},
		);

		if (shipping === null) {
			throw new HttpError(404, "no such shipping method");
		}

		// base tables rather than cart_lines, since FOR UPDATE cannot target a view's join
		// ordered by id so concurrent checkouts lock in the same sequence
		const cart = await sequelize.query<{
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
			{ type: QueryTypes.SELECT, bind: [idUser], transaction },
		);

		if (cart.length === 0) {
			throw new HttpError(409, "cart is empty");
		}

		// the stock CHECK names no product, so the readable 409 is raised here
		for (const line of cart) {
			if (line.quantity > line.stock) {
				throw new HttpError(409, `not enough stock for ${line.product_name}`);
			}
		}

		const created = await sequelize.query<{ id: number }>(
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
			{
				type: QueryTypes.SELECT,
				plain: true,
				bind: [
					idUser,
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
				transaction,
			},
		);

		if (created === null) {
			throw new Error("insert returned no row");
		}

		// data-modifying CTEs run to completion even when nothing selects from them
		await sequelize.query(
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
			{
				type: QueryTypes.DELETE,
				bind: [created.id, idUser],
				transaction,
			},
		);

		// RETURNING cannot read a view, so the order is read back through the summary
		const order = await sequelize.query<OrdersSummary>(
			`SELECT ${columns} FROM orders_summary WHERE id = $1`,
			{
				type: QueryTypes.SELECT,
				plain: true,
				bind: [created.id],
				transaction,
			},
		);

		if (order === null) {
			throw new Error("insert returned no row");
		}

		return order;
	});
}
