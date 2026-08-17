package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
)

func Me(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/me", middleware.Auth(), me(pool))
	r.GET("/me/payments", middleware.Auth(), listPayments(pool))
}

// @Summary  Fetch the caller's profile
// @Tags     me
// @Produce  json
// @Security BearerAuth
// @Success  200 {object} model.UsersMe    "OK"
// @Failure  401 {object} model.Problem "Missing or invalid token"
// @Failure  404 {object} model.Problem "No such user"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /me [get]
func me(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, err := repository.Me(ctx, pool, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			// the token outlived the account
			if errors.Is(err, pgx.ErrNoRows) {
				model.AbortProblem(ctx, http.StatusNotFound, "no such user")
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, user)
	}
}

// @Summary  List the caller's saved payment methods
// @Tags     me
// @Produce  json
// @Security BearerAuth
// @Success  200 {array}  model.UsersPaymentsActive "OK"
// @Failure  401 {object} model.Problem     "Missing or invalid token"
// @Failure  500 {object} model.Problem     "Internal error"
// @Router   /me/payments [get]
// TODO: add POST /me/payments; a fresh fixture has none to validate
func listPayments(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payments, err := repository.Payments(ctx, pool, ctx.GetInt64(middleware.ContextIDUser))
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		ctx.PureJSON(http.StatusOK, payments)
	}
}
