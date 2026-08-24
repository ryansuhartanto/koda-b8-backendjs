import { QueryTypes } from "@sequelize/core";

import { sequelize } from "#/lib/db";
import { HttpError } from "#/lib/problem";
import type { CartRequest, CartSummary } from "#/model/cart";

const empty: CartSummary = { subtotal_idr: 0, items: [] };

export async function summary(idUser: number): Promise<CartSummary> {
	const row = await sequelize.query<CartSummary>(
		`SELECT
			subtotal_idr,
			items
		FROM cart_summary
		WHERE id_user = $1`,
		{ type: QueryTypes.SELECT, plain: true, bind: [idUser] },
	);

	// the view groups cart_items, so an empty cart has no row
	return row ?? empty;
}

export async function set(idUser: number, body: CartRequest): Promise<void> {
	// SELECT rather than a literal id: no check-then-insert window on a soft-deleted variant
	const [, rowCount] = await sequelize.query(
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
		{
			type: QueryTypes.INSERT,
			bind: [idUser, body.id_variant, body.quantity],
		},
	);

	if (rowCount === 0) {
		throw new HttpError(404, "no such variant");
	}
}

export async function remove(idUser: number, idVariant: number): Promise<void> {
	const rowCount = await sequelize.query(
		`DELETE FROM cart_items
		WHERE id_user = $1 AND id_variant = $2`,
		{ type: QueryTypes.DELETE, bind: [idUser, idVariant] },
	);

	if (rowCount === 0) {
		throw new HttpError(404, "no such cart item");
	}
}
