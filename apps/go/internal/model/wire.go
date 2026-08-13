package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

// ID is an int64 everywhere inside the service and a sqid string on the wire.
type ID int64

func (id ID) MarshalJSON() ([]byte, error) {
	s, err := sqid.Encode(int64(id))
	if err != nil {
		return nil, err
	}

	return json.Marshal(s)
}

// a bare number is how the aggregate views hand ids back; a sqid string is how a
// request body carries them, so both are accepted
func (id *ID) UnmarshalJSON(data []byte) error {
	var n int64
	if json.Unmarshal(data, &n) == nil {
		*id = ID(n)
		return nil
	}

	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	decoded, err := sqid.Decode(s)
	if err != nil {
		// identity columns start at 1, so -1 resolves to nothing and the lookup answers
		// 404 — the same thing a malformed path parameter gets from the sqid middleware.
		// Not 0, which binding:"required" would reject as the zero value.
		*id = -1
		return nil
	}

	*id = ID(decoded)

	return nil
}

func (id *ID) Scan(src any) error {
	switch v := src.(type) {
	case nil:
		*id = 0
	case int64:
		*id = ID(v)
	default:
		return fmt.Errorf("cannot scan %T into ID", src)
	}

	return nil
}

func (id ID) Value() (driver.Value, error) { return int64(id), nil }

// Instant carries no fractional seconds, which is what keeps the two services
// byte-identical; RFC3339 with a Z offset is the shared wire format
type Instant time.Time

const instantLayout = "2006-01-02T15:04:05Z"

func (t Instant) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(t).UTC().Format(instantLayout))
}

func (t *Instant) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	// nested timestamps arrive in whatever form to_json produced, offset and all
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return err
	}

	*t = Instant(parsed)

	return nil
}

func (t *Instant) Scan(src any) error {
	switch v := src.(type) {
	case nil:
	case time.Time:
		*t = Instant(v)
	default:
		return fmt.Errorf("cannot scan %T into Instant", src)
	}

	return nil
}

func (t Instant) Value() (driver.Value, error) { return time.Time(t), nil }
