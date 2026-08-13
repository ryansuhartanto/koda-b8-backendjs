package model

type Address struct {
	ID         ID     `db:"id" json:"id"`
	Label      string `db:"label" json:"label"`
	Name       string `db:"name" json:"name"`
	Phone      string `db:"phone" json:"phone"`
	Address    string `db:"address" json:"address"`
	City       string `db:"city" json:"city"`
	Province   string `db:"province" json:"province"`
	PostalCode string `db:"postal_code" json:"postal_code"`
	IsDefault  bool   `db:"is_default" json:"is_default"`
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
