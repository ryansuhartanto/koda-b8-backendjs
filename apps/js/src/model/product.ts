export type VariantOption = {
	option: string;
	value: string;
};

export type ProductVariant = {
	id: number;
	sku?: string;
	stock: number;
	price_idr: number;
	original_price_idr: number;
	options: VariantOption[];
};

// TODO: admin writes need id_category and id_brand here; the view resolves both to
// a name, so a write path cannot round-trip what it just read
export type ProductsSummary = {
	id: number;
	created_at: Date;
	updated_at: Date;
	name: string;
	description?: string;
	brand?: string;
	category?: string;
	urls?: string[];
	price_idr?: number;
	original_price_idr?: number;
	stock: number;
	rating?: number;
	rating_count: number;
	variants?: ProductVariant[];
};
