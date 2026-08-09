package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

func Shipping(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/shipping-methods", listShippingMethods(pool))
}

// listShippingMethods godoc
// @Summary  List shipping methods and their cost
// @Tags     shipping
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
