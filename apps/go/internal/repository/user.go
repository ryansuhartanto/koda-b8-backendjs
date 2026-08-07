package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID           int64
	PasswordHash string
}

func CreateUser(ctx context.Context, pool *pgxpool.Pool, name, email, passwordHash string) (int64, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var id int64

	if err := tx.QueryRow(ctx,
		`INSERT INTO users (
			email,
			password_hash
		)
		VALUES (
			$1,
			$2
		)
		RETURNING id`,
		email, passwordHash,
	).Scan(&id); err != nil {
		return 0, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO profile (
			id_user,
			name
		)
		VALUES (
			$1,
			$2
		)`, id, name); err != nil {
		return 0, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO roles (
			id_user,
			role
		)
		VALUES (
			$1,
			'customer'
		)`, id); err != nil {
		return 0, err
	}

	return id, tx.Commit(ctx)
}

func UserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (User, error) {
	var user User

	err := pool.QueryRow(ctx,
		`SELECT
			id,
			password_hash
		FROM users
		WHERE email = $1 AND deleted_at IS NULL`,
		email,
	).Scan(
		&user.ID,
		&user.PasswordHash,
	)

	return user, err
}
