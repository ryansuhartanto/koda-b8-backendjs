export type OrderItem = {
	id: number;
	id_variant?: string;
	product_name: string;
	variant_name: string;
	unit_price_idr: number;
	quantity: number;
};

export type OrderItemRow = Omit<OrderItem, "id_variant"> & {
	id_order: number;
	id_variant?: number;
};

export type Order = {
	id: number;
	created_at: string;
	status: string;
	payment_method: string;
	promo_code?: string;
	discount_idr: number;
	subtotal_idr: number;
	ship_cost_idr: number;
	total_idr: number;
	ship_name: string;
	ship_phone: string;
	ship_email: string;
	ship_address: string;
	ship_method: string;
	ship_note?: string;
	items: OrderItem[];
};

export type OrderRequest = {
	id_address: number;
	payment_method: string;
	ship_method: string;
	promo_code: string;
	ship_note: string;
};
