package model

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusPacked    OrderStatus = "packed"
	OrderStatusShipped   OrderStatus = "shipped"
	OrderStatusDelivered OrderStatus = "delivered"
	OrderStatusCancelled OrderStatus = "cancelled"
)

type OrderItem struct {
	ID           ID      `json:"id"`
	VariantID    *ID     `json:"id_variant,omitempty"`
	ProductName  string  `json:"product_name"`
	VariantName  *string `json:"variant_name,omitempty"`
	UnitPriceIDR int64   `json:"unit_price_idr"`
	Quantity     int32   `json:"quantity"`
} // @name OrderItem

type OrdersSummary struct {
	ID          ID          `db:"id" json:"id"`
	CreatedAt   Instant     `db:"created_at" json:"created_at"`
	Status      OrderStatus `db:"status" json:"status"`
	// TODO: carries the id only, so a client rendering an order has to join it against
	// GET /payment-methods itself; add pm.name to orders_summary if that gets annoying
	PaymentID   ID          `db:"id_payment" json:"id_payment"`
	PromoCode   *string     `db:"promo_code" json:"promo_code,omitempty"`
	DiscountIDR int64       `db:"discount_idr" json:"discount_idr"`
	SubtotalIDR int64       `db:"subtotal_idr" json:"subtotal_idr"`
	ShipCostIDR int64       `db:"ship_cost_idr" json:"ship_cost_idr"`
	TotalIDR    int64       `db:"total_idr" json:"total_idr"`
	ShipName    string      `db:"ship_name" json:"ship_name"`
	ShipPhone   string      `db:"ship_phone" json:"ship_phone"`
	ShipEmail   string      `db:"ship_email" json:"ship_email"`
	ShipAddress string      `db:"ship_address" json:"ship_address"`
	ShipMethod  string      `db:"ship_method" json:"ship_method"`
	ShipNote    *string     `db:"ship_note" json:"ship_note,omitempty"`
	Items       []OrderItem `db:"items" json:"items"`
} // @name Order

type OrderRequest struct {
	AddressID  ID     `json:"id_address" binding:"required"`
	PaymentID  ID     `json:"id_payment" binding:"required"`
	ShipMethod string `json:"ship_method" binding:"required"`
	PromoCode  string `json:"promo_code"`
	ShipNote   string `json:"ship_note"`
} // @name OrderRequest
