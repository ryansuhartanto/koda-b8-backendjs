export type ProductVariant = {
	id: string;
	name: string;
	description?: string;
	inventory: number;
	price_idr: number;
	original_price_idr: number;
};

export type Product = {
	id: string;
	path: string;
	name: string;
	description?: string;
	brand?: string;
	category?: string;
	img_url?: string;
	price_idr: number;
	original_price_idr: number;
	inventory: number;
	rating?: number;
	rating_count: number;
	variants?: ProductVariant[];
};

export type ProductRow = Omit<Product, "id" | "path" | "variants"> & {
	id: number;
};

export type ProductVariantRow = Omit<ProductVariant, "id"> & { id: number };
