package model

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// RFC 8288 Link header
func Pagination(ctx *gin.Context, total, limit, offset int) {
	ctx.Header("X-Total-Count", strconv.Itoa(total))

	page := func(rel string, at int) string {
		query := ctx.Request.URL.Query()
		query.Set("limit", strconv.Itoa(limit))
		query.Set("offset", strconv.Itoa(at))

		return fmt.Sprintf("<%s?%s>; rel=%q", ctx.Request.URL.Path, query.Encode(), rel)
	}

	// floor to the page boundary; max keeps an empty result from going negative
	last := (max(total, 1) - 1) / limit * limit

	links := []string{page("self", offset), page("first", 0), page("last", last)}

	if offset > 0 {
		links = append(links, page("prev", max(0, offset-limit)))
	}

	if offset+limit < total {
		links = append(links, page("next", offset+limit))
	}

	ctx.Header("Link", strings.Join(links, ", "))
}
