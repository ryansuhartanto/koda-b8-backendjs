package model

type CartItem struct {
	VariantID        ID              `json:"id_variant" binding:"required"`
	ProductID        ID              `json:"id_product" binding:"required"`
	Name             string          `json:"name" binding:"required"`
	VariantOptions   []VariantOption `json:"variant_options,omitempty"`
	SKU              *string         `json:"sku,omitempty"`
	URLs             []string        `json:"urls,omitempty"`
	PriceIDR         int64           `json:"price_idr" binding:"required"`
	OriginalPriceIDR int64           `json:"original_price_idr" binding:"required"`
	Inventory        int32           `json:"inventory" binding:"required"`
	Quantity         int32           `json:"quantity" binding:"required"`
	CreatedAt        Instant         `json:"created_at" binding:"required"`
} // @name CartItem

type CartSummary struct {
	SubtotalIDR int64      `db:"subtotal_idr" json:"subtotal_idr" binding:"required"`
	Items       []CartItem `db:"items" json:"items" binding:"required"`
} // @name Cart

type CartRequest struct {
	VariantID ID    `json:"id_variant" binding:"required"`
	Quantity  int32 `json:"quantity" binding:"required,min=1"`
} // @name CartRequest
