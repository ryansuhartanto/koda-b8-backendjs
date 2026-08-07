export type CartItem = {
	id_variant: string;
	path: string;
	name: string;
	name_variant: string;
	img_url?: string;
	img_alt?: string;
	price_idr: number;
	original_price_idr: number;
	quantity: number;
};

export type CartItemRow = Omit<CartItem, "id_variant" | "path"> & {
	id_variant: number;
	id_product: number;
};

export type CartRequest = {
	id_variant: string;
	quantity: number;
};
