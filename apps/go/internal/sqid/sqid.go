package sqid

import (
	"errors"
	"log"
	"math"

	sqids "github.com/sqids/sqids-go"
)

const minLength = 6

// obfuscation rather than a secret: both services must agree on it byte for byte,
// so it is a constant here instead of an environment variable that could drift
const alphabet = "2V0Q9JjRCEi6wtHTrIlgAXFLyBp53emSYs8GzUMN1OZDbocfh4quPn7adWxKkv"

var ErrInvalid = errors.New("invalid sqid")

var shared = must()

func must() *sqids.Sqids {
	s, err := sqids.New(sqids.Options{Alphabet: alphabet, MinLength: minLength})
	if err != nil {
		log.Fatal(err)
	}

	return s
}

func Encode(id int64) (string, error) {
	if id < 0 {
		return "", ErrInvalid
	}

	return shared.Encode([]uint64{uint64(id)})
}

func Decode(s string) (int64, error) {
	ids := shared.Decode(s)
	if len(ids) != 1 || ids[0] > math.MaxInt64 {
		return 0, ErrInvalid
	}

	// padded and out-of-alphabet forms still decode; round-tripping rejects them
	canonical, err := shared.Encode(ids)
	if err != nil || canonical != s {
		return 0, ErrInvalid
	}

	return int64(ids[0]), nil
}
