package model

import "encoding/json"

type CategoriesSummary struct {
	ID           ID      `db:"id" json:"id"`
	Name         string  `db:"name" json:"name"`
	Icon         *string `db:"icon" json:"icon,omitempty"`
	Img          *string `db:"img" json:"img,omitempty"`
	ProductCount int64   `db:"product_count" json:"product_count"`
} // @name Category

type BrandsSummary struct {
	ID           ID     `db:"id" json:"id"`
	Name         string `db:"name" json:"name"`
	ProductCount int64  `db:"product_count" json:"product_count"`
} // @name Brand

type ShippingMethod struct {
	ID      ID     `db:"id" json:"id"`
	Name    string `db:"name" json:"name"`
	CostIDR int64  `db:"cost_idr" json:"cost_idr"`
} // @name ShippingMethod

type PaymentMethod struct {
	ID       ID              `db:"id" json:"id"`
	Name     string          `db:"name" json:"name"`
	Metadata json.RawMessage `db:"metadata" json:"metadata"`
} // @name PaymentMethod
