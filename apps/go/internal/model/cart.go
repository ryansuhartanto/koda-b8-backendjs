package model

type CartItem struct {
	VariantID        ID              `json:"id_variant"`
	ProductID        ID              `json:"id_product"`
	Name             string          `json:"name"`
	VariantOptions   []VariantOption `json:"variant_options,omitempty"`
	SKU              *string         `json:"sku,omitempty"`
	URLs             []string        `json:"urls,omitempty"`
	PriceIDR         int64           `json:"price_idr"`
	OriginalPriceIDR int64           `json:"original_price_idr"`
	Inventory        int32           `json:"inventory"`
	Quantity         int32           `json:"quantity"`
	CreatedAt        Instant         `json:"created_at"`
} // @name CartItem

type CartSummary struct {
	SubtotalIDR int64      `db:"subtotal_idr" json:"subtotal_idr"`
	Items       []CartItem `db:"items" json:"items"`
} // @name Cart

type CartRequest struct {
	VariantID ID    `json:"id_variant" binding:"required"`
	Quantity  int32 `json:"quantity" binding:"required,min=1"`
} // @name CartRequest
