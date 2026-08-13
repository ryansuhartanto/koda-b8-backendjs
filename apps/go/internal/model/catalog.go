package model

import "encoding/json"

type CategoriesSummary struct {
	ID           ID      `db:"id" json:"id" binding:"required"`
	Name         string  `db:"name" json:"name" binding:"required"`
	Icon         *string `db:"icon" json:"icon,omitempty"`
	Img          *string `db:"img" json:"img,omitempty"`
	ProductCount int64   `db:"product_count" json:"product_count" binding:"required"`
} // @name Category

type BrandsSummary struct {
	ID           ID     `db:"id" json:"id" binding:"required"`
	Name         string `db:"name" json:"name" binding:"required"`
	ProductCount int64  `db:"product_count" json:"product_count" binding:"required"`
} // @name Brand

type ShippingMethod struct {
	ID      ID     `db:"id" json:"id" binding:"required"`
	Name    string `db:"name" json:"name" binding:"required"`
	CostIDR int64  `db:"cost_idr" json:"cost_idr" binding:"required"`
} // @name ShippingMethod

type PaymentMethod struct {
	ID       ID              `db:"id" json:"id" binding:"required"`
	Name     string          `db:"name" json:"name" binding:"required"`
	Metadata json.RawMessage `db:"metadata" json:"metadata" binding:"required" swaggertype:"object"`
} // @name PaymentMethod
