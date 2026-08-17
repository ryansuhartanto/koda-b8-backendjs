package main

import (
	"context"
	_ "embed"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/PeterTakahashi/gin-openapi/openapiui"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/handler"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/notify"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/socket"
)

// @title       BeliMudah API
// @version     1.0
// @description E-commerce API for the BeliMudah storefront.

// @contact.name   Ryan Suhartanto
// @contact.url    https://github.com/ryansuhartanto/koda-b8-backend
// @contact.email  suhartanto@kekkon.nexus

// @license.name  MIT

// @servers.url  http://localhost:3001

//go:embed docs/swagger.json
var spec []byte

//go:embed docs/asyncapi.yaml
var events []byte

// @securitydefinitions.bearerauth BearerAuth
func main() {
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	r := gin.Default()

	r.Use(middleware.Cors())

	r.Use(func(ctx *gin.Context) {
		ctx.Header("X-Powered-By", "Gin Gonic")
	})

	r.Use(middleware.ETag())

	// after ETag, so a rejected sqid still carries the tag express sets on its own
	r.Use(middleware.Sqids())

	r.Any("/", func(ctx *gin.Context) {
		ctx.Header("Location", "/docs")
		ctx.Status(http.StatusMovedPermanently)
	})

	docs := openapiui.WrapHandler(openapiui.Config{
		SpecURL:      "/docs/openapi.json",
		SpecProvider: func() ([]byte, error) { return spec, nil },
		Title:        "BeliMudah API",
	})

	r.GET("/docs", docs)

	r.GET("/docs/*any", func(ctx *gin.Context) {
		switch ctx.Param("any") {
		case "", "/", "/index.html", "/openapi.json":
			docs(ctx)
		case "/asyncapi.yaml":
			ctx.Data(http.StatusOK, "application/yaml; charset=utf-8", events)
		default:
			model.AbortProblem(ctx, http.StatusNotFound, "no such endpoint")
		}
	})

	r.GET("/healthz", handleHealthz(pool))

	handler.Auth(r, pool)
	handler.Product(r, pool)
	handler.Catalog(r, pool)
	handler.Me(r, pool)
	handler.Cart(r, pool)
	handler.Address(r, pool)
	handler.Order(r, pool)

	// both frameworks answer an unknown path in their own format, not RFC 9457
	r.NoRoute(func(ctx *gin.Context) {
		model.AbortProblem(ctx, http.StatusNotFound, "no such endpoint")
	})

	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "3001"
	}

	audience := notify.NewAudience()

	io := socket.New(audience)
	defer io.Close()

	if err := notify.Listen(ctx, io, audience); err != nil {
		log.Fatal(err)
	}

	// ahead of the router, so socket.io skips the middleware chain
	mux := http.NewServeMux()
	mux.Handle("/socket.io/", socket.Handler(io))
	mux.Handle("/", r)

	server := &http.Server{Addr: ":" + port, Handler: mux}

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	closing, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(closing); err != nil {
		log.Print(err)
	}

	pool.Close()
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

		ctx.PureJSON(http.StatusOK, gin.H{"status": "ok"})
	}
}
