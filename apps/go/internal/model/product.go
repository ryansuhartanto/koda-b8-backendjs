package model

import "github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/slug"

func ProductPath(sqid, name string) string {
	return "/products/" + sqid + "/" + slug.Make(name)
}

type ProductVariant struct {
	ID               string `json:"id" binding:"required"`
	Name             string `json:"name" binding:"required"`
	Description      string `json:"description,omitempty"`
	Inventory        int    `json:"inventory" binding:"required"`
	PriceIdr         int64  `json:"price_idr" binding:"required"`
	OriginalPriceIdr int64  `json:"original_price_idr" binding:"required"`
} // @name ProductVariant

type Product struct {
	ID               string           `json:"id" binding:"required"`
	Path             string           `json:"path" binding:"required"`
	Name             string           `json:"name" binding:"required"`
	Description      string           `json:"description,omitempty"`
	Brand            string           `json:"brand" binding:"required"`
	Category         string           `json:"category" binding:"required"`
	ImgURL           string           `json:"img_url" binding:"required"`
	PriceIdr         int64            `json:"price_idr" binding:"required"`
	OriginalPriceIdr int64            `json:"original_price_idr" binding:"required"`
	Inventory        int              `json:"inventory" binding:"required"`
	Rating           float64          `json:"rating" binding:"required"`
	RatingCount      int              `json:"rating_count" binding:"required"`
	Variants         []ProductVariant `json:"variants,omitempty"`
} // @name Product
