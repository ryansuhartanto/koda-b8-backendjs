package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
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

	// role is part of the primary key, so it has no column default to fall back on
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

func Me(ctx context.Context, pool *pgxpool.Pool, idUser int64) (model.UsersMe, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id,
			email,
			created_at,
			updated_at,
			name,
			phone,
			birthdate,
			gender,
			avatar,
			roles
		FROM users_me
		WHERE id = $1`, idUser)
	if err != nil {
		return model.UsersMe{}, err
	}

	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[model.UsersMe])
}

func Payments(ctx context.Context, pool *pgxpool.Pool, idUser int64) ([]model.UsersPaymentsActive, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id,
			created_at,
			id_payment,
			type,
			is_default,
			data
		FROM users_payments_active
		WHERE id_user = $1
		ORDER BY is_default DESC, id`, idUser)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.UsersPaymentsActive])
}
