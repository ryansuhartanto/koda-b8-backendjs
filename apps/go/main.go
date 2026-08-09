package main

import (
	"context"
	_ "embed"
	"errors"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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

//go:embed docs/swagger.json
var spec []byte

// Scalar renders client-side. Inlining the spec keeps /docs to a single
// request, so a load balancer can't route the follow-up fetch to a sibling
// service that answers /docs/* with its own HTML.
var docsPage = template.Must(template.New("docs").Parse(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="referrer" content="no-referrer" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BeliMudah API</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        content: {{ . }},
        tagsSorter: 'alpha',
      })
    </script>
  </body>
</html>
`))

func handleDocs(ctx *gin.Context) {
	ctx.Header("Content-Type", "text/html; charset=utf-8")
	if err := docsPage.Execute(ctx.Writer, template.JS(spec)); err != nil {
		log.Print(err)
	}
}

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

	r.Use(func(ctx *gin.Context) {
		ctx.Header("X-Powered-By", "Gin Gonic")
	})

	r.Use(middleware.ETag())

	r.Any("/", func(ctx *gin.Context) {
		ctx.Header("Location", "/docs")
		ctx.Status(http.StatusMovedPermanently)
	})

	r.GET("/docs", handleDocs)

	r.GET("/healthz", handleHealthz(pool))

	handler.Auth(r, pool)
	handler.Product(r, pool, codec)
	handler.Shipping(r, pool)
	handler.Cart(r, pool, codec)
	handler.Address(r, pool)
	handler.Order(r, pool, codec)

	// both frameworks answer an unknown path in their own format, not RFC 9457
	r.NoRoute(func(ctx *gin.Context) {
		model.AbortProblem(ctx, http.StatusNotFound, "no such endpoint")
	})

	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "3001"
	}

	server := &http.Server{Addr: ":" + port, Handler: r}

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
