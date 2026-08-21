package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

func Cart(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/me/cart", middleware.Auth(), listCart(pool))
	r.POST("/me/cart", middleware.Auth(), setCartItem(pool))
	r.DELETE("/me/cart/:id_variant", middleware.Auth(), deleteCartItem(pool))
}

// @Summary  Fetch the cart
// @Tags     cart
// @Produce  json
// @Security BearerAuth
// @Success  200 {object} model.CartSummary    "OK"
// @Failure  401 {object} model.Problem "Invalid token"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/cart [get]
func listCart(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		cart, err := repository.Cart(ctx, pool, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, cart)
	}
}

// @Summary  Set a cart line quantity
// @Tags     cart
// @Produce  json
// @Security BearerAuth
// @Param    body body model.CartRequest true "Line"
// @Success  204 "No Content"
// @Failure  400 {object} model.Problem "Invalid body"
// @Failure  401 {object} model.Problem "Invalid token"
// @Failure  404 {object} model.Problem "No such variant"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/cart [post]
func setCartItem(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.CartRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"id_variant and a quantity of at least 1 are required")
			return
		}

		found, err := repository.SetCartItem(ctx, pool,
			ctx.GetInt64(middleware.ContextIDUser), int64(req.VariantID), req.Quantity)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		if !found {
			model.AbortProblem(ctx, http.StatusNotFound, "no such variant")
			return
		}

		ctx.Status(http.StatusNoContent)
	}
}

// @Summary  Remove a cart line
// @Tags     cart
// @Produce  json
// @Security BearerAuth
// @Param    id_variant path string true "Variant sqid"
// @Success  204 "No Content"
// @Failure  401 {object} model.Problem "Invalid token"
// @Failure  404 {object} model.Problem "No such cart item"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/cart/{id_variant} [delete]
func deleteCartItem(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		deleted, err := repository.DeleteCartItem(ctx, pool,
			ctx.GetInt64(middleware.ContextIDUser), ctx.GetInt64("id_variant"))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		if !deleted {
			model.AbortProblem(ctx, http.StatusNotFound, "no such cart item")
			return
		}

		ctx.Status(http.StatusNoContent)
	}
}
