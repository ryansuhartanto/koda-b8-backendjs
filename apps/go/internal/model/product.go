package model

type VariantOption struct {
	Option string `json:"option"`
	Value  string `json:"value"`
} // @name VariantOption

type ProductVariant struct {
	ID               ID              `json:"id"`
	SKU              *string         `json:"sku,omitempty"`
	Stock            int32           `json:"stock"`
	PriceIDR         int64           `json:"price_idr"`
	OriginalPriceIDR int64           `json:"original_price_idr"`
	Options          []VariantOption `json:"options"`
} // @name ProductVariant

// TODO: admin writes need id_category and id_brand here; the view resolves both to
// a name, so a write path cannot round-trip what it just read
type ProductsSummary struct {
	ID               ID               `db:"id" json:"id"`
	CreatedAt        Instant          `db:"created_at" json:"created_at"`
	UpdatedAt        Instant          `db:"updated_at" json:"updated_at"`
	Name             string           `db:"name" json:"name"`
	Description      *string          `db:"description" json:"description,omitempty"`
	Brand            *string          `db:"brand" json:"brand,omitempty"`
	Category         *string          `db:"category" json:"category,omitempty"`
	URLs             []string         `db:"urls" json:"urls,omitempty"`
	PriceIDR         *int64           `db:"price_idr" json:"price_idr,omitempty"`
	OriginalPriceIDR *int64           `db:"original_price_idr" json:"original_price_idr,omitempty"`
	Stock            int64            `db:"stock" json:"stock"`
	Rating           *float64         `db:"rating" json:"rating,omitempty"`
	RatingCount      int64            `db:"rating_count" json:"rating_count"`
	Variants         []ProductVariant `db:"variants" json:"variants,omitempty"`
} // @name Product
