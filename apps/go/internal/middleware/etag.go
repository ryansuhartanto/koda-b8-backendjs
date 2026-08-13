package middleware

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type etagWriter struct {
	gin.ResponseWriter
	body   bytes.Buffer
	status int
}

func (w *etagWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func (w *etagWriter) WriteString(s string) (int, error) {
	return w.body.WriteString(s)
}

func (w *etagWriter) WriteHeader(status int) {
	w.status = status
}

func (w *etagWriter) WriteHeaderNow() {}

// npm's etag: W/"<length in hex>-<sha1, base64, first 27 characters>"
func entity(body []byte) string {
	sum := sha1.Sum(body)

	return `W/"` + strconv.FormatInt(int64(len(body)), 16) + "-" +
		base64.StdEncoding.EncodeToString(sum[:])[:27] + `"`
}

// TODO: nothing invalidates this on write. Safe only while every route is a read;
// revisit before the admin write routes land.
func ETag() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		buffered := &etagWriter{ResponseWriter: ctx.Writer, status: http.StatusOK}
		ctx.Writer = buffered

		ctx.Next()

		ctx.Writer = buffered.ResponseWriter
		body := buffered.body.Bytes()

		if len(body) == 0 {
			ctx.Writer.WriteHeader(buffered.status)
			return
		}

		tag := entity(body)
		ctx.Header("ETag", tag)

		if strings.Contains(ctx.GetHeader("If-None-Match"), tag) {
			ctx.Writer.WriteHeader(http.StatusNotModified)
			return
		}

		ctx.Writer.WriteHeader(buffered.status)
		_, _ = ctx.Writer.Write(body)
	}
}
