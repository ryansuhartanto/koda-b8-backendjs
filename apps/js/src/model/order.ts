export type OrderStatus =
	| "pending"
	| "packed"
	| "shipped"
	| "delivered"
	| "cancelled";

export type OrderItem = {
	id: number;
	id_variant?: number;
	product_name: string;
	variant_name?: string;
	unit_price_idr: number;
	quantity: number;
};

export type OrdersSummary = {
	id: number;
	created_at: Date;
	status: OrderStatus;
	// TODO: add pm.name to orders_summary so clients need not join /payment-methods
	id_payment: number;
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
	id_payment: number;
	ship_method: string;
	promo_code: string;
	ship_note: string;
};
