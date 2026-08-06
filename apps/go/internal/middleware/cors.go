package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Cors() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Content-Length", "Authorization"},
		// browsers withhold non-safelisted response headers from JS unless named here
		ExposeHeaders: []string{"Link", "X-Total-Count"},
	})
}
