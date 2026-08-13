package model

type Address struct {
	ID         ID     `db:"id" json:"id" binding:"required"`
	Label      string `db:"label" json:"label" binding:"required"`
	Name       string `db:"name" json:"name" binding:"required"`
	Phone      string `db:"phone" json:"phone" binding:"required"`
	Address    string `db:"address" json:"address" binding:"required"`
	City       string `db:"city" json:"city" binding:"required"`
	Province   string `db:"province" json:"province" binding:"required"`
	PostalCode string `db:"postal_code" json:"postal_code" binding:"required"`
	IsDefault  bool   `db:"is_default" json:"is_default" binding:"required"`
} // @name Address

type AddressRequest struct {
	Label      string `json:"label" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Phone      string `json:"phone" binding:"required"`
	Address    string `json:"address" binding:"required"`
	City       string `json:"city" binding:"required"`
	Province   string `json:"province" binding:"required"`
	PostalCode string `json:"postal_code" binding:"required"`
	IsDefault  bool   `json:"is_default"`
} // @name AddressRequest
