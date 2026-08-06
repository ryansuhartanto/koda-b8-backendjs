package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/PeterTakahashi/gin-openapi/openapiui"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/handler"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

// @title       BeliMudah API
// @version     1.0
// @description E-commerce API for the BeliMudah storefront.

// @contact.name   Ryan Suhartanto
// @contact.url    https://github.com/ryansuhartanto/koda-b8-backend
// @contact.email  suhartanto@kekkon.nexus

// @license.name  MIT

// @servers.url  http://localhost:3001

// @securitydefinitions.bearerauth BearerAuth
func main() {
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	codec, err := sqid.New(os.Getenv("SQIDS_ALPHABET"))
	if err != nil {
		log.Fatal(err)
	}

	r := gin.Default()

	r.Use(middleware.Cors())

	r.Any("/", func(ctx *gin.Context) {
		ctx.Redirect(http.StatusMovedPermanently, "/docs")
	})

	r.GET("/docs/*any", openapiui.WrapHandler(openapiui.Config{
		SpecURL:      "/docs/openapi.json",
		SpecFilePath: "./docs/swagger.json",
		Title:        "BeliMudah API",
	}))

	r.GET("/healthz", handleHealthz(pool))

	handler.Auth(r, pool)
	handler.Product(r, pool, codec)
	handler.Shipping(r, pool)
	handler.Cart(r, pool, codec)
	handler.Address(r, pool)
	handler.Order(r, pool, codec)

	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "3002"
	}

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

// handleHealthz godoc
// @Summary  Liveness and database reachability
// @Tags     meta
// @Produce  json
// @Success  200 {object} map[string]string "OK"
// @Failure  503 {object} model.Problem     "Database unreachable"
// @Router   /healthz [get]
func handleHealthz(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if err := pool.Ping(ctx); err != nil {
			model.AbortProblem(ctx, http.StatusServiceUnavailable, err.Error())
			return
		}

		model.JSON(ctx, http.StatusOK, gin.H{"status": "ok"})
	}
}
