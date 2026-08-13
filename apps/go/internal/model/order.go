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
	ID           ID      `json:"id" binding:"required"`
	VariantID    *ID     `json:"id_variant,omitempty"`
	ProductName  string  `json:"product_name" binding:"required"`
	VariantName  *string `json:"variant_name,omitempty"`
	UnitPriceIDR int64   `json:"unit_price_idr" binding:"required"`
	Quantity     int32   `json:"quantity" binding:"required"`
} // @name OrderItem

// TODO: id_payment carries the id only, so a client rendering an order has to join
// it against GET /payment-methods itself; add pm.name to orders_summary if that
// gets annoying
type OrdersSummary struct {
	ID          ID          `db:"id" json:"id" binding:"required"`
	CreatedAt   Instant     `db:"created_at" json:"created_at" binding:"required"`
	Status      OrderStatus `db:"status" json:"status" binding:"required" swaggertype:"string" enums:"pending,packed,shipped,delivered,cancelled"`
	PaymentID   ID          `db:"id_payment" json:"id_payment" binding:"required"`
	PromoCode   *string     `db:"promo_code" json:"promo_code,omitempty"`
	DiscountIDR int64       `db:"discount_idr" json:"discount_idr" binding:"required"`
	SubtotalIDR int64       `db:"subtotal_idr" json:"subtotal_idr" binding:"required"`
	ShipCostIDR int64       `db:"ship_cost_idr" json:"ship_cost_idr" binding:"required"`
	TotalIDR    int64       `db:"total_idr" json:"total_idr" binding:"required"`
	ShipName    string      `db:"ship_name" json:"ship_name" binding:"required"`
	ShipPhone   string      `db:"ship_phone" json:"ship_phone" binding:"required"`
	ShipEmail   string      `db:"ship_email" json:"ship_email" binding:"required"`
	ShipAddress string      `db:"ship_address" json:"ship_address" binding:"required"`
	ShipMethod  string      `db:"ship_method" json:"ship_method" binding:"required"`
	ShipNote    *string     `db:"ship_note" json:"ship_note,omitempty"`
	Items       []OrderItem `db:"items" json:"items" binding:"required"`
} // @name Order

type OrderRequest struct {
	AddressID  ID     `json:"id_address" binding:"required"`
	PaymentID  ID     `json:"id_payment" binding:"required"`
	ShipMethod string `json:"ship_method" binding:"required"`
	PromoCode  string `json:"promo_code"`
	ShipNote   string `json:"ship_note"`
} // @name OrderRequest
