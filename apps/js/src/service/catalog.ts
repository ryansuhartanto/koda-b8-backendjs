import { pool } from "#/lib/db";
import type {
	BrandsSummary,
	CategoriesSummary,
	PaymentMethod,
	ShippingMethod,
} from "#/model/catalog";

export async function categories(): Promise<CategoriesSummary[]> {
	const { rows } = await pool.query<CategoriesSummary>(
		`SELECT
			id,
			name,
			icon,
			img,
			product_count
		FROM categories_summary
		ORDER BY name`,
	);

	return rows;
}

export async function brands(): Promise<BrandsSummary[]> {
	const { rows } = await pool.query<BrandsSummary>(
		`SELECT
			id,
			name,
			product_count
		FROM brands_summary
		ORDER BY name`,
	);

	return rows;
}

export async function shippingMethods(): Promise<ShippingMethod[]> {
	const { rows } = await pool.query<ShippingMethod>(
		`SELECT
			id,
			name,
			cost_idr
		FROM shipping_methods
		WHERE deleted_at IS NULL
		ORDER BY cost_idr, id`,
	);

	return rows;
}

export async function paymentMethods(): Promise<PaymentMethod[]> {
	const { rows } = await pool.query<PaymentMethod>(
		`SELECT
			id,
			name,
			metadata
		FROM payment_methods
		WHERE is_available AND deleted_at IS NULL
		ORDER BY name`,
	);

	return rows;
}
