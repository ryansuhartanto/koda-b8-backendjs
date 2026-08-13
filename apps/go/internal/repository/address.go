package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
)

const addressColumns = `
	id,
	label,
	name,
	phone,
	address,
	city,
	province,
	postal_code,
	is_default`

func Addresses(ctx context.Context, pool *pgxpool.Pool, idUser int64) ([]model.Address, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+addressColumns+`
		FROM users_address
		WHERE id_user = $1 AND deleted_at IS NULL
		ORDER BY is_default DESC, id`, idUser)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.Address])
}

func CreateAddress(ctx context.Context, pool *pgxpool.Pool, idUser int64, req model.AddressRequest) (model.Address, error) {
	var zero model.Address

	tx, err := pool.Begin(ctx)
	if err != nil {
		return zero, err
	}
	defer tx.Rollback(ctx)

	// the partial unique index allows only one default per user
	if req.IsDefault {
		if _, err := tx.Exec(ctx,
			`UPDATE users_address SET is_default = FALSE WHERE id_user = $1 AND deleted_at IS NULL`,
			idUser); err != nil {
			return zero, err
		}
	}

	rows, err := tx.Query(ctx,
		`INSERT INTO users_address (
			id_user,
			label,
			name,
			phone,
			address,
			city,
			province,
			postal_code,
			is_default
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9
		)
		RETURNING `+addressColumns,
		idUser, req.Label, req.Name, req.Phone, req.Address, req.City, req.Province, req.PostalCode, req.IsDefault)
	if err != nil {
		return zero, err
	}

	address, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[model.Address])
	if err != nil {
		return zero, err
	}

	return address, tx.Commit(ctx)
}
