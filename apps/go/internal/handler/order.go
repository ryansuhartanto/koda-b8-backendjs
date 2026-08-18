package handler

import (
	"errors"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

const invalidStatus = "status must be one of pending, packed, shipped, delivered, cancelled"

func Order(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/me/orders", middleware.Auth(), listOrders(pool))
	r.POST("/me/orders", middleware.Auth(), createOrder(pool))
	r.GET("/orders", middleware.Auth(), middleware.Admin(), listAllOrders(pool))
	r.PATCH("/orders/:id_order", middleware.Auth(), middleware.Admin(), updateOrderStatus(pool))
}

// @Summary  List every order, newest first
// @Tags     orders
// @Produce  json
// @Security BearerAuth
// @Param    status query string false "One of pending, packed, shipped, delivered, cancelled" Enums(pending, packed, shipped, delivered, cancelled)
// @Param    limit  query int    false "Rows to return, 1 to 100" default(20)
// @Param    offset query int    false "Rows to skip"             default(0)
// @Success  200 {array}  model.OrdersSummary "OK"
// @Header   200 {string}  Link          "RFC 8288 pagination links: self, first, last, prev, next"
// @Header   200 {integer} X-Total-Count "Rows matching the filter, ignoring limit and offset"
// @Failure  400 {object} model.Problem "Invalid query"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  403 {object} model.Problem "Not an admin"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /orders [get]
func listAllOrders(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		status := model.OrderStatus(ctx.Query("status"))
		if _, ok := repository.OrderTransitions[status]; status != "" && !ok {
			model.AbortProblem(ctx, http.StatusBadRequest, invalidStatus)
			return
		}

		limit, err := intQuery(ctx, "limit", defaultLimit, 1, maxLimit)
		if err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest, err.Error())
			return
		}

		offset, err := intQuery(ctx, "offset", 0, 0, math.MaxInt32)
		if err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest, err.Error())
			return
		}

		orders, total, err := repository.AllOrders(ctx, pool, repository.OrderFilter{
			Status: status,
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		model.Pagination(ctx, total, limit, offset)
		ctx.PureJSON(http.StatusOK, orders)
	}
}

// @Summary  Advance an order's status
// @Tags     orders
// @Produce  json
// @Security BearerAuth
// @Param    id_order path string true "Order sqid"
// @Param    body body model.OrderStatusRequest true "Status"
// @Success  200 {object} model.OrdersSummary "OK"
// @Failure  400 {object} model.Problem "Invalid body"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  403 {object} model.Problem "Not an admin"
// @Failure  404 {object} model.Problem "No such order"
// @Failure  409 {object} model.Problem "Disallowed transition"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /orders/{id_order} [patch]
func updateOrderStatus(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.OrderStatusRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest, invalidStatus)
			return
		}

		if _, ok := repository.OrderTransitions[req.Status]; !ok {
			model.AbortProblem(ctx, http.StatusBadRequest, invalidStatus)
			return
		}

		order, err := repository.UpdateOrderStatus(ctx, pool, ctx.GetInt64("id_order"), req.Status)
		if err != nil {
			var orderErr *repository.OrderError
			if errors.As(err, &orderErr) {
				model.AbortProblem(ctx, orderErr.Status, orderErr.Detail)
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, order)
	}
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
