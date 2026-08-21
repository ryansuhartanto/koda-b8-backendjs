package token

import (
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const TTL = 24 * time.Hour

type claims struct {
	jwt.RegisteredClaims
	Roles []string `json:"roles"`
}

type Claims struct {
	IDUser int64
	Roles  []string
}

func secret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

func Sign(idUser int64, roles []string) (string, error) {
	now := time.Now()

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(idUser, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(TTL)),
		},
		Roles: roles,
	}).SignedString(secret())
}

func Parse(raw string) (Claims, error) {
	parsed := &claims{}

	_, err := jwt.ParseWithClaims(raw, parsed, func(*jwt.Token) (any, error) {
		return secret(), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()})) // reject algorithm confusion
	if err != nil {
		return Claims{}, err
	}

	idUser, err := strconv.ParseInt(parsed.Subject, 10, 64)
	if err != nil {
		return Claims{}, err
	}

	// a token issued before roles were claimed carries none, so not an admin
	return Claims{IDUser: idUser, Roles: parsed.Roles}, nil
}
