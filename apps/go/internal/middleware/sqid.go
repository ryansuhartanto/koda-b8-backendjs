package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

const idPrefix = "id_"

// Sqids decodes every id_* path parameter once, before any handler runs. Gin
// resolves the route before running the handler chain, so ctx.Params is already
// populated even though this is registered globally.
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
