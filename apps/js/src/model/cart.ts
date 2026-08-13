import type { VariantOption } from "#/model/product";

export type CartItem = {
	id_variant: number;
	id_product: number;
	name: string;
	variant_options?: VariantOption[];
	sku?: string;
	urls?: string[];
	price_idr: number;
	original_price_idr: number;
	inventory: number;
	quantity: number;
	// nested in the aggregate, so Postgres has already rendered it to text
	created_at: string;
};

export type CartSummary = {
	subtotal_idr: number;
	items: CartItem[];
};

export type CartRequest = {
	id_variant: number;
	quantity: number;
};
