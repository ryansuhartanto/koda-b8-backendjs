package handler

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/slug"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

func Product(r *gin.Engine, pool *pgxpool.Pool, codec *sqid.Codec) {
	r.GET("/products", listProducts(pool, codec))

	r.GET("/products/:sqid", productBySqid(pool, codec))
	r.GET("/products/:sqid/*slug", productBySqid(pool, codec))
}

func intQuery(ctx *gin.Context, key string, fallback, min, max int) (int, error) {
	raw := ctx.Query(key)
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil || value < min || value > max {
		return 0, errors.New(key + " must be an integer between " + strconv.Itoa(min) + " and " + strconv.Itoa(max))
	}

	return value, nil
}

// listProducts godoc
// @Summary  List products
// @Tags     products
// @Produce  json
// @Param    search   query string false "Match against the product name"
// @Param    category query string false "Category name"
// @Param    brand    query string false "Brand name"
// @Param    sort     query string false "One of newest, price_asc, price_desc, rating" Enums(newest, price_asc, price_desc, rating)
// @Param    limit    query int    false "Rows to return, 1 to 100" default(20)
// @Param    offset   query int    false "Rows to skip"             default(0)
// @Success  200 {array}  model.Product "OK"
// @Header   200 {string}  Link          "RFC 8288 pagination links: self, first, last, prev, next"
// @Header   200 {integer} X-Total-Count "Rows matching the filter, ignoring limit and offset"
// @Failure  400 {object} model.Problem "Invalid query"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /products [get]
func listProducts(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		sort := ctx.DefaultQuery("sort", "newest")
		if _, ok := repository.ProductSort[sort]; !ok {
			model.AbortProblem(ctx, http.StatusBadRequest, "sort must be one of newest, price_asc, price_desc, rating")
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

		products, total, err := repository.Products(ctx, pool, codec, repository.ProductFilter{
			Search:   ctx.Query("search"),
			Category: ctx.Query("category"),
			Brand:    ctx.Query("brand"),
			Sort:     sort,
			Limit:    limit,
			Offset:   offset,
		})
		if err != nil {
			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		model.Pagination(ctx, total, limit, offset)
		model.JSON(ctx, http.StatusOK, products)
	}
}

// productBySqid godoc
// @Summary  Fetch one product
// @Tags     products
// @Produce  json
// @Param    sqid path string true  "Product sqid"
// @Param    slug path string false "Decorative slug, ignored when resolving and corrected by redirect"
// @Success  200 {object} model.Product "OK"
// @Success  302 "Slug is absent or stale"
// @Header   302 {string} Location "Canonical path for the product"
// @Failure  404 {object} model.Problem "No such product"
// @Failure  500 {object} model.Problem "Internal error"
// @Router   /products/{sqid}/{slug} [get]
func productBySqid(pool *pgxpool.Pool, codec *sqid.Codec) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id, err := codec.Decode(ctx.Param("sqid"))
		if err != nil {
			model.AbortProblem(ctx, http.StatusNotFound, "no such product")
			return
		}

		product, err := repository.ProductByID(ctx, pool, codec, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				model.AbortProblem(ctx, http.StatusNotFound, "no such product")
				return
			}

			model.AbortProblem(ctx, http.StatusInternalServerError, err.Error())
			return
		}

		if strings.TrimPrefix(ctx.Param("slug"), "/") != slug.Make(product.Name) {
			ctx.Header("Location", product.Path)
			ctx.Status(http.StatusFound)
			return
		}

		model.JSON(ctx, http.StatusOK, product)
	}
}
