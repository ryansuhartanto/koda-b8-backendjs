package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

func Address(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/me/addresses", middleware.Auth(), listAddresses(pool))
	r.POST("/me/addresses", middleware.Auth(), createAddress(pool))
}

// listAddresses godoc
// @Summary  List the caller's addresses, default first
// @Tags     addresses
// @Produce  json
// @Security BearerAuth
// @Success  200 {array}  model.Address "OK"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/addresses [get]
func listAddresses(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		addresses, err := repository.Addresses(ctx, pool, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, addresses)
	}
}

// createAddress godoc
// @Summary  Add an address to the caller's account
// @Tags     addresses
// @Produce  json
// @Security BearerAuth
// @Param    body body model.AddressRequest true "Address"
// @Success  201 {object} model.Address "Created"
// @Failure  400 {object} model.Problem "Invalid body"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me/addresses [post]
func createAddress(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.AddressRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"label, name, phone, address, city, province and postal_code are required")
			return
		}

		address, err := repository.CreateAddress(ctx, pool, ctx.GetInt64(middleware.ContextIDUser), req)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusCreated, address)
	}
}
