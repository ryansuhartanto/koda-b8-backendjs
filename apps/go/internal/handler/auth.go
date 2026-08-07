package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/token"
)

// distinguishing a missing account from a bad password is a user-enumeration oracle
const invalidCredentials = "invalid email or password"

func Auth(r *gin.Engine, pool *pgxpool.Pool) {
	r.POST("/auth/register", register(pool))
	r.POST("/auth/login", login(pool))
}

// register godoc
// @Summary  Register an account
// @Tags     auth
// @Produce  json
// @Param    body body model.RegisterRequest true "Credentials"
// @Success  201 {object} model.TokenResponse "Created"
// @Failure  400 {object} model.Problem       "Invalid body"
// @Failure  409 {object} model.Problem       "Email already registered"
// @Failure  500 {object} model.Problem       "Internal error"
// @Router   /auth/register [post]
func register(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.RegisterRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"name, email and a password of at least 8 characters are required")
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		id, err := repository.CreateUser(ctx, pool, req.Name, req.Email, string(hash))
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.SQLState() == "23505" { // unique_violation
				model.AbortProblem(ctx, http.StatusConflict, "email already registered")
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		signed, err := token.Sign(id)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		model.JSON(ctx, http.StatusCreated, model.TokenResponse{Token: signed})
	}
}

// login godoc
// @Summary  Exchange credentials for a token
// @Tags     auth
// @Produce  json
// @Param    body body model.LoginRequest true "Credentials"
// @Success  200 {object} model.TokenResponse "OK"
// @Failure  400 {object} model.Problem       "Invalid body"
// @Failure  401 {object} model.Problem       "Invalid credentials"
// @Failure  500 {object} model.Problem       "Internal error"
// @Router   /auth/login [post]
func login(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req model.LoginRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			model.AbortProblem(ctx, http.StatusBadRequest,
				"email and password are required")
			return
		}

		user, err := repository.UserByEmail(ctx, pool, req.Email)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				model.AbortProblem(ctx, http.StatusUnauthorized, invalidCredentials)
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
			model.AbortProblem(ctx, http.StatusUnauthorized, invalidCredentials)
			return
		}

		signed, err := token.Sign(user.ID)
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		model.JSON(ctx, http.StatusOK, model.TokenResponse{Token: signed})
	}
}
