package model

type CartItem struct {
	IDVariant        string  `json:"id_variant" binding:"required"`
	Path             string  `json:"path" binding:"required"`
	Name             string  `json:"name" binding:"required"`
	NameVariant      string  `json:"name_variant" binding:"required"`
	Img              *string `json:"img,omitempty"`
	PriceIdr         int64   `json:"price_idr" binding:"required"`
	OriginalPriceIdr int64   `json:"original_price_idr" binding:"required"`
	Quantity         int     `json:"quantity" binding:"required"`
} // @name CartItem

type CartRequest struct {
	IDVariant string `json:"id_variant" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,min=1"`
} // @name CartRequest
