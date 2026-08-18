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

export type ProductRequest = {
	name: string;
	description: string;
	id_category: number | undefined;
	id_brand: number | undefined;
	sku: string;
	stock: number;
	original_price_idr: number;
	discount_price_idr: number | undefined;
	urls: string[];
};

// TODO: the view resolves category and brand to names, so an edit path needs the ids
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
