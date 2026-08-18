package middleware

import (
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/token"
)

const (
	ContextIDUser = "id_user"
	ContextRoles  = "roles"
	RoleAdmin     = "admin"
)

func Auth() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		raw, ok := strings.CutPrefix(ctx.GetHeader("Authorization"), "Bearer ")
		if !ok {
			model.AbortProblem(ctx, http.StatusUnauthorized, "missing bearer token")
			return
		}

		claims, err := token.Parse(raw)
		if err != nil {
			model.AbortProblem(ctx, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		ctx.Set(ContextIDUser, claims.IDUser)
		ctx.Set(ContextRoles, claims.Roles)
		ctx.Next()
	}
}

func Admin() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		roles, _ := ctx.Get(ContextRoles)

		if list, ok := roles.([]string); !ok || !slices.Contains(list, RoleAdmin) {
			model.AbortProblem(ctx, http.StatusForbidden, "admin only")
			return
		}

		ctx.Next()
	}
}
