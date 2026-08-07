package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

func Order(r *gin.Engine, pool *pgxpool.Pool, codec *sqid.Codec) {
	r.GET("/orders", middleware.Auth(), listOrders(pool, codec))
	r.POST("/orders", middleware.Auth(), createOrder(pool, codec))
}

// listOrders godoc
// @Summary  List the caller's orders, newest first
// @Tags     orders
// @Produce  json
// @Security BearerAuth
// @Success  200 {array}  model.Order   "OK"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /orders [get]
func listOrders(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		orders, err := repository.Orders(ctx, pool, codec, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		model.JSON(ctx, http.StatusOK, orders)
	}
}

// createOrder godoc
// @Summary  Turn the caller's cart into an order
// @Tags     orders
// @Produce  json
// @Security BearerAuth
// @Param    body body model.OrderRequest true "Checkout"
// @Success  201 {object} model.Order   "Created"
// @Failure  400 {object} model.Problem "Invalid body"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  404 {object} model.Problem "No such address or shipping method"
// @Failure  409 {object} model.Problem "Empty cart or insufficient stock"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /orders [post]
func createOrder(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.OrderRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"id_address, payment_method and ship_method are required")
			return
		}

		order, err := repository.CreateOrder(ctx, pool, codec, ctx.GetInt64(middleware.ContextIDUser), req)
		if err != nil {
			var orderErr *repository.OrderError
			if errors.As(err, &orderErr) {
				model.AbortProblem(ctx, orderErr.Status, orderErr.Detail)
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		model.JSON(ctx, http.StatusCreated, order)
	}
}
