import { QueryTypes } from "@sequelize/core";

import { sequelize } from "#/lib/db";
import type {
	BrandsSummary,
	CategoriesSummary,
	PaymentMethod,
	ShippingMethod,
} from "#/model/catalog";

export async function categories(): Promise<CategoriesSummary[]> {
	return sequelize.query<CategoriesSummary>(
		`SELECT
			id,
			name,
			icon,
			img,
			product_count
		FROM categories_summary
		ORDER BY name`,
		{ type: QueryTypes.SELECT },
	);
}

export async function brands(): Promise<BrandsSummary[]> {
	return sequelize.query<BrandsSummary>(
		`SELECT
			id,
			name,
			product_count
		FROM brands_summary
		ORDER BY name`,
		{ type: QueryTypes.SELECT },
	);
}

export async function shippingMethods(): Promise<ShippingMethod[]> {
	return sequelize.query<ShippingMethod>(
		`SELECT
			id,
			name,
			cost_idr
		FROM shipping_methods
		WHERE deleted_at IS NULL
		ORDER BY cost_idr, id`,
		{ type: QueryTypes.SELECT },
	);
}

export async function paymentMethods(): Promise<PaymentMethod[]> {
	return sequelize.query<PaymentMethod>(
		`SELECT
			id,
			name,
			metadata
		FROM payment_methods
		WHERE is_available AND deleted_at IS NULL
		ORDER BY name`,
		{ type: QueryTypes.SELECT },
	);
}
