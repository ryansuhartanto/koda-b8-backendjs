package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

const idPrefix = "id_"

// Gin resolves the route before the handler chain, so ctx.Params is already populated
func Sqids() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		for _, param := range ctx.Params {
			if !strings.HasPrefix(param.Key, idPrefix) {
				continue
			}

			id, err := sqid.Decode(param.Value)
			if err != nil {
				model.AbortProblem(ctx, http.StatusNotFound,
					"no such "+strings.TrimPrefix(param.Key, idPrefix))
				return
			}

			ctx.Set(param.Key, id)
		}

		ctx.Next()
	}
}
