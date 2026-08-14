package socket

import (
	"log"
	"net/http"
	"strings"

	socketio "github.com/doquangtan/socketio/v4"
)

func New() *socketio.Io {
	io := socketio.New()

	io.OnConnection(func(socket *socketio.Socket) {
		log.Printf("[SOCK] Connected id=%s", socket.Id)

		socket.On("chat", func(event *socketio.EventPayload) {
			log.Printf("[SOCK] Chat id=%s msg=%v", socket.Id, event.Data)
		})

		socket.On("disconnect", func(event *socketio.EventPayload) {
			log.Printf("[SOCK] Disconnect id=%s reason=%v", socket.Id, event.Data)
		})
	})

	return io
}

// the library carries no cors of its own, and this handler is mounted ahead of
// the router, so it answers for itself the way socket.io does on the js side
func allow(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Add("Vary", "Origin")
}

// Handler upgrades where the library would not. It matches Connection against
// the exact string "Upgrade", but RFC 9110 makes the field a list of
// case-insensitive tokens: firefox sends "keep-alive, Upgrade" and node sends
// "upgrade", and both fall back to polling without this.
func Handler(io *socketio.Io) http.Handler {
	inner := io.HttpHandler()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allow(w, r)

		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE")
			w.Header().Set("Vary", "Origin, Access-Control-Request-Headers")
			w.WriteHeader(http.StatusNoContent)

			return
		}

		for _, value := range r.Header.Values("Connection") {
			for _, token := range strings.Split(value, ",") {
				if strings.EqualFold(strings.TrimSpace(token), "upgrade") {
					r.Header.Set("Connection", "Upgrade")

					break
				}
			}
		}

		inner.ServeHTTP(w, r)
	})
}
