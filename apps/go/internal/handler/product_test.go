package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/middleware"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/token"
)

func TestListProductsRejectsUnknownSort(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/products", listProducts(nil))

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/products?sort=bogus", nil))

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	if got := rec.Header().Get("Content-Type"); got != "application/problem+json; charset=utf-8" {
		t.Errorf("Content-Type = %q, want application/problem+json; charset=utf-8", got)
	}
}

// handlers read ctx.GetInt64("id_*") unchecked, so the middleware must reject first
func TestSqidsMiddlewareRejectsMalformed(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(middleware.Sqids())
	Product(r, nil)

	valid, err := sqid.Encode(1)
	if err != nil {
		t.Fatal(err)
	}

	for name, path := range map[string]string{
		"out of alphabet": "/products/!!!!!!",
		"too short":       "/products/a",
		"non-canonical":   "/products/2" + valid,
	} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want %d", name, rec.Code, http.StatusNotFound)
		}

		if got := rec.Header().Get("Content-Type"); got != "application/problem+json; charset=utf-8" {
			t.Errorf("%s: Content-Type = %q, want application/problem+json; charset=utf-8", name, got)
		}
	}
}

func TestCreateProductRejectsCustomer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "products-test-secret")

	signed, err := token.Sign(1, []string{"customer"})
	if err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	Product(r, nil)

	req := httptest.NewRequest(http.MethodPost, "/products",
		strings.NewReader(`{"name":"Test","original_price_idr":1000}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signed)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}

	if got := rec.Header().Get("Content-Type"); got != "application/problem+json; charset=utf-8" {
		t.Errorf("Content-Type = %q, want application/problem+json; charset=utf-8", got)
	}
}

func TestCreateProductRejectsMissingPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.POST("/products", createProduct(nil))

	req := httptest.NewRequest(http.MethodPost, "/products", strings.NewReader(`{"name":"Test"}`))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestProductRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	Product(r, nil)

	routes := map[string]bool{}
	for _, route := range r.Routes() {
		routes[route.Path] = true
	}

	for _, want := range []string{"/products", "/products/:id_product"} {
		if !routes[want] {
			t.Errorf("route %q not registered", want)
		}
	}
}
