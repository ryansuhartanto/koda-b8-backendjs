package notify

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sync"

	socketio "github.com/doquangtan/socketio/v4"
	"github.com/jackc/pgx/v5"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

const Channel = "changes"

type change struct {
	Table  string `json:"table"`
	Op     string `json:"op"`
	ID     int64  `json:"id"`
	IDUser *int64 `json:"id_user"`
}

// a struct, not a map: encoding/json sorts map keys, js emits in declaration order
type event struct {
	Op string `json:"op"`
	ID string `json:"id"`
}

// the library keeps socketJoinRoom unexported, so its rooms cannot be joined
type Audience struct {
	mu      sync.RWMutex
	sockets map[int64]map[string]*socketio.Socket
}

func NewAudience() *Audience {
	return &Audience{sockets: make(map[int64]map[string]*socketio.Socket)}
}

func (a *Audience) Join(idUser int64, socket *socketio.Socket) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.sockets[idUser] == nil {
		a.sockets[idUser] = make(map[string]*socketio.Socket)
	}

	a.sockets[idUser][socket.Id] = socket
}

func (a *Audience) Leave(socket *socketio.Socket) {
	a.mu.Lock()
	defer a.mu.Unlock()

	for idUser, sockets := range a.sockets {
		delete(sockets, socket.Id)

		if len(sockets) == 0 {
			delete(a.sockets, idUser)
		}
	}
}

func (a *Audience) emit(idUser int64, event string, body any) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	for _, socket := range a.sockets[idUser] {
		if err := socket.Emit(event, body); err != nil {
			log.Printf("[SOCK] Emit id=%s: %v", socket.Id, err)
		}
	}
}

// its own connection, not one from the pool: a session holding LISTEN is never
// returnable, and pool.Close blocks until every acquired connection comes back
func Listen(ctx context.Context, io *socketio.Io, audience *Audience) error {
	conn, err := pgx.Connect(ctx, "")
	if err != nil {
		return err
	}

	if _, err := conn.Exec(ctx, "LISTEN "+Channel); err != nil {
		return errors.Join(err, conn.Close(ctx))
	}

	go func() {
		defer func() { _ = conn.Close(context.WithoutCancel(ctx)) }()

		for {
			message, err := conn.WaitForNotification(ctx)
			if err != nil {
				if !errors.Is(err, context.Canceled) {
					log.Printf("[SOCK] Listen: %v", err)
				}

				return
			}

			dispatch(io, audience, message.Payload)
		}
	}()

	return nil
}

func dispatch(io *socketio.Io, audience *Audience, payload string) {
	parsed := change{}
	if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
		log.Printf("[SOCK] Change: %v", err)

		return
	}

	id, err := sqid.Encode(parsed.ID)
	if err != nil {
		log.Printf("[SOCK] Change: %v", err)

		return
	}

	name := "product"
	if parsed.Table == "orders" {
		name = "order"
	}

	body := event{Op: parsed.Op, ID: id}

	log.Printf("[SOCK] Change event=%s op=%s id=%s", name, parsed.Op, id)

	if parsed.IDUser == nil {
		if err := io.Emit(name, body); err != nil {
			log.Printf("[SOCK] Emit: %v", err)
		}

		return
	}

	audience.emit(*parsed.IDUser, name, body)
}
