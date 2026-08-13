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

type UsersMe struct {
	ID        ID         `db:"id" json:"id"`
	Email     string     `db:"email" json:"email"`
	CreatedAt Instant    `db:"created_at" json:"created_at"`
	UpdatedAt Instant    `db:"updated_at" json:"updated_at"`
	Name      *string    `db:"name" json:"name,omitempty"`
	Phone     *string    `db:"phone" json:"phone,omitempty"`
	// a DATE, kept as the text the database rendered so no timezone can shift the day
	Birthdate *string    `db:"birthdate" json:"birthdate,omitempty"`
	Gender    *Gender    `db:"gender" json:"gender,omitempty"`
	Avatar    *string    `db:"avatar" json:"avatar,omitempty"`
	Roles     []UserRole `db:"roles" json:"roles"`
} // @name User

type UsersAddressShipping struct {
	ID      ID     `db:"id" json:"id"`
	Name    string `db:"name" json:"name"`
	Phone   string `db:"phone" json:"phone"`
	Email   string `db:"email" json:"email"`
	Address string `db:"address" json:"address"`
} // @name ShippingAddress

type UsersPaymentsActive struct {
	ID        ID              `db:"id" json:"id"`
	CreatedAt Instant         `db:"created_at" json:"created_at"`
	PaymentID ID              `db:"id_payment" json:"id_payment"`
	Type      string          `db:"type" json:"type"`
	IsDefault bool            `db:"is_default" json:"is_default"`
	Data      json.RawMessage `db:"data" json:"data"`
} // @name UserPayment
