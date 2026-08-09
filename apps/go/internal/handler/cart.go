package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

func Cart(r *gin.Engine, pool *pgxpool.Pool, codec *sqid.Codec) {
	r.GET("/cart", middleware.Auth(), listCart(pool, codec))
	r.POST("/cart", middleware.Auth(), setCartItem(pool, codec))
	r.DELETE("/cart/:id_variant", middleware.Auth(), deleteCartItem(pool, codec))
}

// listCart godoc
// @Summary  List the caller's cart
// @Tags     cart
// @Produce  json
// @Security BearerAuth
// @Success  200 {array}  model.CartItem "OK"
// @Failure  401 {object} model.Problem  "Missing or invalid token"
// @Failure  500 {object} model.Problem  "Internal error"
// @Router   /cart [get]
func listCart(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		items, err := repository.CartItems(ctx, pool, codec, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, items)
	}
}

// setCartItem godoc
// @Summary  Set the quantity of one cart line
// @Tags     cart
// @Produce  json
// @Security BearerAuth
// @Param    body body model.CartRequest true "Line"
// @Success  204 "No Content"
// @Failure  400 {object} model.Problem "Invalid body"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  404 {object} model.Problem "No such variant"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /cart [post]
func setCartItem(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.CartRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"id_variant and a quantity of at least 1 are required")
			return
		}

		idVariant, err := codec.Decode(req.IDVariant)
		if err != nil {
			model.AbortProblem(ctx, http.StatusNotFound, "no such variant")
			return
		}

		found, err := repository.SetCartItem(ctx, pool,
			ctx.GetInt64(middleware.ContextIDUser), idVariant, req.Quantity)
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

// deleteCartItem godoc
// @Summary  Remove one variant from the cart
// @Tags     cart
// @Produce  json
// @Security BearerAuth
// @Param    id_variant path string true "Variant sqid"
// @Success  204 "No Content"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /cart/{id_variant} [delete]
func deleteCartItem(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		idVariant, err := codec.Decode(ctx.Param("id_variant"))
		if err != nil {
			model.AbortProblem(ctx, http.StatusNotFound, "no such cart item")
			return
		}

		deleted, err := repository.DeleteCartItem(ctx, pool, ctx.GetInt64(middleware.ContextIDUser), idVariant)
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
