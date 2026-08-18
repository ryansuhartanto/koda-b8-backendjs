package model

type VariantOption struct {
	Option string `json:"option" binding:"required"`
	Value  string `json:"value" binding:"required"`
} // @name VariantOption

type ProductVariant struct {
	ID               ID              `json:"id" binding:"required"`
	SKU              *string         `json:"sku,omitempty"`
	Stock            int32           `json:"stock" binding:"required"`
	PriceIDR         int64           `json:"price_idr" binding:"required"`
	OriginalPriceIDR int64           `json:"original_price_idr" binding:"required"`
	Options          []VariantOption `json:"options" binding:"required"`
} // @name ProductVariant

type ProductRequest struct {
	Name             string   `json:"name" binding:"required"`
	Description      string   `json:"description"`
	CategoryID       *ID      `json:"id_category,omitempty" swaggertype:"string"`
	BrandID          *ID      `json:"id_brand,omitempty" swaggertype:"string"`
	SKU              string   `json:"sku"`
	Stock            int32    `json:"stock"`
	OriginalPriceIDR int64    `json:"original_price_idr" binding:"required"`
	DiscountPriceIDR *int64   `json:"discount_price_idr,omitempty"`
	URLs             []string `json:"urls,omitempty"`
} // @name ProductRequest

// TODO: the view resolves category and brand to names, so an edit path needs the ids
type ProductsSummary struct {
	ID               ID               `db:"id" json:"id" binding:"required"`
	CreatedAt        Instant          `db:"created_at" json:"created_at" binding:"required"`
	UpdatedAt        Instant          `db:"updated_at" json:"updated_at" binding:"required"`
	Name             string           `db:"name" json:"name" binding:"required"`
	Description      *string          `db:"description" json:"description,omitempty"`
	Brand            *string          `db:"brand" json:"brand,omitempty"`
	Category         *string          `db:"category" json:"category,omitempty"`
	URLs             []string         `db:"urls" json:"urls,omitempty"`
	PriceIDR         *int64           `db:"price_idr" json:"price_idr,omitempty"`
	OriginalPriceIDR *int64           `db:"original_price_idr" json:"original_price_idr,omitempty"`
	Stock            int64            `db:"stock" json:"stock" binding:"required"`
	Rating           *float64         `db:"rating" json:"rating,omitempty"`
	RatingCount      int64            `db:"rating_count" json:"rating_count" binding:"required"`
	Variants         []ProductVariant `db:"variants" json:"variants,omitempty"`
} // @name Product
