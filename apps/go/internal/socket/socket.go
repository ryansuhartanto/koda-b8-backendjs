package socket

import (
	"errors"
	"log"
	"net/http"
	"strings"

	socketio "github.com/doquangtan/socketio/v4"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/notify"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/token"
)

func New(audience *notify.Audience) *socketio.Io {
	io := socketio.New()

	io.OnConnection(func(socket *socketio.Socket) {
		log.Printf("[SOCK] Connected id=%s", socket.Id)

		// an event, not the handshake: Handshake.Auth is never filled
		socket.On("auth", func(event *socketio.EventPayload) {
			idUser, err := claim(event.Data)
			if err != nil {
				_ = socket.Emit("auth", map[string]bool{"ok": false})

				return
			}

			audience.Join(idUser, socket)
			_ = socket.Emit("auth", map[string]bool{"ok": true})
		})

		socket.On("chat", func(event *socketio.EventPayload) {
			log.Printf("[SOCK] Chat id=%s msg=%v", socket.Id, event.Data)
		})

		socket.On("disconnect", func(event *socketio.EventPayload) {
			audience.Leave(socket)
			log.Printf("[SOCK] Disconnect id=%s reason=%v", socket.Id, event.Data)
		})
	})

	return io
}

func claim(data []any) (int64, error) {
	if len(data) == 0 {
		return 0, errors.New("no token")
	}

	raw, ok := data[0].(string)
	if !ok {
		return 0, errors.New("token is not a string")
	}

	return token.Parse(raw)
}

// the library carries no cors of its own, and this is mounted ahead of the router
func allow(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Add("Vary", "Origin")
}

// the library matches Connection against the exact string "Upgrade"; RFC 9110 makes
// it a token list
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
