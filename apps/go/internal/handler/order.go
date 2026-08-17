package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

// TODO: admin GET and PATCH /orders go here; /me/orders holds the caller's own
func Order(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/me/orders", middleware.Auth(), listOrders(pool))
	r.POST("/me/orders", middleware.Auth(), createOrder(pool))
}

// @Summary  List the caller's orders, newest first
// @Tags     orders
// @Produce  json
// @Security BearerAuth
// @Success  200 {array}  model.OrdersSummary   "OK"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/orders [get]
func listOrders(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		orders, err := repository.Orders(ctx, pool, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, orders)
	}
}

// @Summary  Turn the caller's cart into an order
// @Tags     orders
// @Produce  json
// @Security BearerAuth
// @Param    body body model.OrderRequest true "Checkout"
// @Success  201 {object} model.OrdersSummary   "Created"
// @Failure  400 {object} model.Problem "Invalid body"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  404 {object} model.Problem "No such address, payment method or shipping method"
// @Failure  409 {object} model.Problem "Empty cart or insufficient stock"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/orders [post]
func createOrder(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.OrderRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"id_address, id_payment and ship_method are required")
			return
		}

		order, err := repository.CreateOrder(ctx, pool, ctx.GetInt64(middleware.ContextIDUser), req)
		if err != nil {
			var orderErr *repository.OrderError
			if errors.As(err, &orderErr) {
				model.AbortProblem(ctx, orderErr.Status, orderErr.Detail)
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusCreated, order)
	}
}
