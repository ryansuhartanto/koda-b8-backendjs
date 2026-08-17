package sqid

import (
	"errors"
	"math"
	"strings"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	for _, id := range []int64{0, 1, 2, 9, 10, 99, 100, 1000, 123456, math.MaxInt32, math.MaxInt64} {
		encoded, err := Encode(id)
		if err != nil {
			t.Fatalf("Encode(%d): %v", id, err)
		}

		if len(encoded) < minLength {
			t.Errorf("Encode(%d) = %q, shorter than %d", id, encoded, minLength)
		}

		decoded, err := Decode(encoded)
		if err != nil {
			t.Fatalf("Decode(%q): %v", encoded, err)
		}

		if decoded != id {
			t.Errorf("Decode(Encode(%d)) = %d", id, decoded)
		}
	}
}

func TestDecodeRejects(t *testing.T) {
	valid, err := Encode(42)
	if err != nil {
		t.Fatal(err)
	}

	cases := map[string]string{
		"empty":            "",
		"zero":             "0",
		"out of alphabet":  "!!!!!!",
		"padded":           valid + " ",
		"absurdly long":    strings.Repeat(alphabet, 100),
		"trailing garbage": valid + "zzzz",
	}

	for name, input := range cases {
		if _, err := Decode(input); !errors.Is(err, ErrInvalid) {
			t.Errorf("Decode(%s = %q) did not reject", name, input)
		}
	}
}

func TestDecodeRejectsNonCanonical(t *testing.T) {
	valid, err := Encode(7)
	if err != nil {
		t.Fatal(err)
	}

	for _, padding := range []string{alphabet[:1], alphabet[:2], alphabet[:3]} {
		input := padding + valid

		if input == valid {
			continue
		}

		id, err := Decode(input)
		if err == nil {
			t.Errorf("Decode(%q) = %d, accepted a non-canonical form of %q", input, id, valid)
		}
	}
}

func TestEncodeRejectsNegative(t *testing.T) {
	if _, err := Encode(-1); !errors.Is(err, ErrInvalid) {
		t.Error("Encode(-1) did not reject")
	}
}
