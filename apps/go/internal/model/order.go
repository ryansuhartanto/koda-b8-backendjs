package model

type OrderItem struct {
	ID           int64  `json:"id" binding:"required"`
	IDVariant    string `json:"id_variant,omitempty"`
	ProductName  string `json:"product_name" binding:"required"`
	VariantName  string `json:"variant_name" binding:"required"`
	UnitPriceIdr int64  `json:"unit_price_idr" binding:"required"`
	Quantity     int    `json:"quantity" binding:"required"`
} // @name OrderItem

type Order struct {
	ID            int64       `json:"id" binding:"required"`
	CreatedAt     string      `json:"created_at" binding:"required"`
	Status        string      `json:"status" binding:"required"`
	PaymentMethod string      `json:"payment_method" binding:"required"`
	PromoCode     *string     `json:"promo_code,omitempty"`
	DiscountIdr   int64       `json:"discount_idr" binding:"required"`
	SubtotalIdr   int64       `json:"subtotal_idr" binding:"required"`
	ShipCostIdr   int64       `json:"ship_cost_idr" binding:"required"`
	TotalIdr      int64       `json:"total_idr" binding:"required"`
	ShipName      string      `json:"ship_name" binding:"required"`
	ShipPhone     string      `json:"ship_phone" binding:"required"`
	ShipEmail     string      `json:"ship_email" binding:"required"`
	ShipAddress   string      `json:"ship_address" binding:"required"`
	ShipMethod    string      `json:"ship_method" binding:"required"`
	ShipNote      *string     `json:"ship_note,omitempty"`
	Items         []OrderItem `json:"items" binding:"required"`
} // @name Order

type OrderRequest struct {
	IDAddress     int64  `json:"id_address" binding:"required"`
	PaymentMethod string `json:"payment_method" binding:"required"`
	ShipMethod    string `json:"ship_method" binding:"required"`
	PromoCode     string `json:"promo_code"`
	ShipNote      string `json:"ship_note"`
} // @name OrderRequest
