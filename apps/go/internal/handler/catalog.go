package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

// TODO: admin POST and PATCH for /categories and /brands go here
func Catalog(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/categories", listCategories(pool))
	r.GET("/brands", listBrands(pool))
	r.GET("/shipping-methods", listShippingMethods(pool))
	r.GET("/payment-methods", listPaymentMethods(pool))
}

// @Summary  List categories and how many products each holds
// @Tags     catalog
// @Produce  json
// @Success  200 {array}  model.CategoriesSummary "OK"
// @Failure  500 {object} model.Problem  "Internal error"
// @Router   /categories [get]
func listCategories(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		categories, err := repository.Categories(ctx, pool)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, categories)
	}
}

// @Summary  List brands and how many products each holds
// @Tags     catalog
// @Produce  json
// @Success  200 {array}  model.BrandsSummary   "OK"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /brands [get]
func listBrands(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		brands, err := repository.Brands(ctx, pool)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, brands)
	}
}

// @Summary  List shipping methods and their cost
// @Tags     catalog
// @Produce  json
// @Success  200 {array}  model.ShippingMethod "OK"
// @Failure  500 {object} model.Problem        "Internal error"
// @Router   /shipping-methods [get]
func listShippingMethods(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		methods, err := repository.ShippingMethods(ctx, pool)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, methods)
	}
}

// @Summary  List the payment methods an order can be placed with
// @Tags     catalog
// @Produce  json
// @Success  200 {array}  model.PaymentMethod "OK"
// @Failure  500 {object} model.Problem       "Internal error"
// @Router   /payment-methods [get]
func listPaymentMethods(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		methods, err := repository.PaymentMethods(ctx, pool)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, methods)
	}
}
