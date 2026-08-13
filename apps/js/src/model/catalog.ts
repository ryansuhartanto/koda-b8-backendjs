export type CategoriesSummary = {
	id: number;
	name: string;
	icon?: string;
	img?: string;
	product_count: number;
};

export type BrandsSummary = {
	id: number;
	name: string;
	product_count: number;
};

export type ShippingMethod = {
	id: number;
	name: string;
	cost_idr: number;
};

export type PaymentMethod = {
	id: number;
	name: string;
	metadata: Record<string, unknown>;
};
