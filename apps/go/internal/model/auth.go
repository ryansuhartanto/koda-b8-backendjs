package model

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
} // @name RegisterRequest

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
} // @name LoginRequest

type AuthResponse struct {
	Token string `json:"token" binding:"required"`
} // @name TokenResponse
