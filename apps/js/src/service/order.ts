import { pool, transact } from "#/lib/db";
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
	const args: unknown[] = [];
	let where = "";

	if (filter.status !== undefined) {
		args.push(filter.status);
		where = `WHERE status = $${args.length}`;
	}

	args.push(filter.limit, filter.offset);

	// COUNT(*) OVER() carries the total on every row, so no second round trip
	const { rows } = await pool.query<OrdersSummary & { total: string }>(
		`SELECT ${columns}, COUNT(*) OVER() AS total
		FROM orders_summary
		${where} ORDER BY created_at DESC, id DESC
		LIMIT $${args.length - 1} OFFSET $${args.length}`,
		args,
	);

	return {
		orders: rows.map(({ total: _total, ...row }) => row),
		total: Number(rows[0]?.total ?? 0),
	};
}

export async function listOwn(idUser: number): Promise<OrdersSummary[]> {
	const { rows } = await pool.query<OrdersSummary>(
		`SELECT ${columns}
		FROM orders_summary
		WHERE id_user = $1
		ORDER BY created_at DESC, id DESC`,
		[idUser],
	);

	return rows;
}

export async function advance(
	id: number,
	next: OrderStatus,
): Promise<OrdersSummary> {
	return transact(async (client) => {
		// locked so two admins cannot both read the same status and both advance it
		const current = await client.query<{ status: OrderStatus }>(
			`SELECT status FROM orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
			[id],
		);

		const [order] = current.rows;

		if (order === undefined) {
			throw new HttpError(404, "no such order");
		}

		if (!transitions[order.status].includes(next)) {
			throw new HttpError(
				409,
				`cannot move an order from ${order.status} to ${next}`,
			);
		}

		await client.query(`UPDATE orders SET status = $1 WHERE id = $2`, [
			next,
			id,
		]);

		const summary = await client.query<OrdersSummary>(
			`SELECT ${columns} FROM orders_summary WHERE id = $1`,
			[id],
		);

		const [updated] = summary.rows;

		if (updated === undefined) {
			throw new Error("update returned no row");
		}

		return updated;
	});
}

export async function checkout(
	idUser: number,
	body: OrderRequest,
): Promise<OrdersSummary> {
	return transact(async (client) => {
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
			[body.id_address, idUser],
		);

		const [ship] = address.rows;

		if (ship === undefined) {
			throw new HttpError(404, "no such address");
		}

		const payment = await client.query(
			`SELECT
				id
			FROM payment_methods
			WHERE id = $1 AND is_available AND deleted_at IS NULL`,
			[body.id_payment],
		);

		if (payment.rowCount === 0) {
			throw new HttpError(404, "no such payment method");
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
			throw new HttpError(404, "no such shipping method");
		}

		// base tables rather than cart_lines, since FOR UPDATE cannot target a view's join
		// ordered by id so concurrent checkouts lock in the same sequence
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
			[idUser],
		);

		if (cart.rows.length === 0) {
			throw new HttpError(409, "cart is empty");
		}

		// the stock CHECK names no product, so the readable 409 is raised here
		for (const line of cart.rows) {
			if (line.quantity > line.stock) {
				throw new HttpError(409, `not enough stock for ${line.product_name}`);
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
		);

		const [row] = created.rows;

		if (row === undefined) {
			throw new Error("insert returned no row");
		}

		// data-modifying CTEs run to completion even when nothing selects from them
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
			[row.id, idUser],
		);

		// RETURNING cannot read a view, so the order is read back through the summary
		const summary = await client.query<OrdersSummary>(
			`SELECT ${columns} FROM orders_summary WHERE id = $1`,
			[row.id],
		);

		const [order] = summary.rows;

		if (order === undefined) {
			throw new Error("insert returned no row");
		}

		return order;
	});
}
