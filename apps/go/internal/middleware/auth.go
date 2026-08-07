package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/token"
)

const ContextIDUser = "id_user"

func Auth() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		raw, ok := strings.CutPrefix(ctx.GetHeader("Authorization"), "Bearer ")
		if !ok {
			model.AbortProblem(ctx, http.StatusUnauthorized, "missing bearer token")
			return
		}

		idUser, err := token.Parse(raw)
		if err != nil {
			model.AbortProblem(ctx, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		ctx.Set(ContextIDUser, idUser)
		ctx.Next()
	}
}
