package handler

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/repository"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/token"
)

func TestCreateOrderRejectsMissingAddress(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.POST("/me/orders", createOrder(nil))

	req := httptest.NewRequest(http.MethodPost, "/me/orders", strings.NewReader(`{"id_payment":"BCA","ship_method":"JNE Reguler"}`))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	if got := rec.Header().Get("Content-Type"); got != "application/problem+json; charset=utf-8" {
		t.Errorf("Content-Type = %q, want application/problem+json; charset=utf-8", got)
	}
}

func TestAllOrdersRejectsCustomer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "orders-test-secret")

	signed, err := token.Sign(1, []string{"customer"})
	if err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	Order(r, nil)

	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
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

func TestUpdateOrderStatusRejectsUnknownStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.PATCH("/orders/:id_order", updateOrderStatus(nil))

	req := httptest.NewRequest(http.MethodPatch, "/orders/abcdef", strings.NewReader(`{"status":"bogus"}`))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestOrderTransitionsOnlyMoveForward(t *testing.T) {
	sequence := []model.OrderStatus{
		model.OrderStatusPending,
		model.OrderStatusPacked,
		model.OrderStatusShipped,
		model.OrderStatusDelivered,
	}

	for from, targets := range repository.OrderTransitions {
		for _, to := range targets {
			if to == model.OrderStatusCancelled {
				continue
			}

			if slices.Index(sequence, to) <= slices.Index(sequence, from) {
				t.Errorf("%s -> %s does not move forward", from, to)
			}
		}
	}

	for _, terminal := range []model.OrderStatus{model.OrderStatusDelivered, model.OrderStatusCancelled} {
		if len(repository.OrderTransitions[terminal]) != 0 {
			t.Errorf("%s should be terminal, has %v", terminal, repository.OrderTransitions[terminal])
		}
	}
}
