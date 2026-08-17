package model

import "encoding/json"

type UserRole string

const (
	UserRoleCustomer UserRole = "customer"
	UserRoleAdmin    UserRole = "admin"
)

type Gender string

const (
	GenderMale   Gender = "M"
	GenderFemale Gender = "F"
	GenderOther  Gender = "X"
)

// Birthdate stays text so no timezone shifts the day; on the field this would become
// its schema description.
type UsersMe struct {
	ID        ID         `db:"id" json:"id" binding:"required"`
	Email     string     `db:"email" json:"email" binding:"required"`
	CreatedAt Instant    `db:"created_at" json:"created_at" binding:"required"`
	UpdatedAt Instant    `db:"updated_at" json:"updated_at" binding:"required"`
	Name      *string    `db:"name" json:"name,omitempty"`
	Phone     *string    `db:"phone" json:"phone,omitempty"`
	Birthdate *string    `db:"birthdate" json:"birthdate,omitempty"`
	Gender    *Gender    `db:"gender" json:"gender,omitempty"`
	Avatar    *string    `db:"avatar" json:"avatar,omitempty"`
	Roles     []UserRole `db:"roles" json:"roles" binding:"required"`
} // @name User

type UsersAddressShipping struct {
	ID      ID     `db:"id" json:"id" binding:"required"`
	Name    string `db:"name" json:"name" binding:"required"`
	Phone   string `db:"phone" json:"phone" binding:"required"`
	Email   string `db:"email" json:"email" binding:"required"`
	Address string `db:"address" json:"address" binding:"required"`
} // @name ShippingAddress

type UsersPaymentsActive struct {
	ID        ID              `db:"id" json:"id" binding:"required"`
	CreatedAt Instant         `db:"created_at" json:"created_at" binding:"required"`
	PaymentID ID              `db:"id_payment" json:"id_payment" binding:"required"`
	Type      string          `db:"type" json:"type" binding:"required"`
	IsDefault bool            `db:"is_default" json:"is_default" binding:"required"`
	Data      json.RawMessage `db:"data" json:"data" binding:"required" swaggertype:"object"`
} // @name UserPayment
