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

func scanAddress(row pgx.Row) (model.Address, error) {
	var a model.Address

	err := row.Scan(
		&a.ID,
		&a.Label,
		&a.Name,
		&a.Phone,
		&a.Address,
		&a.City,
		&a.Province,
		&a.PostalCode,
		&a.IsDefault,
	)

	return a, err
}

func Addresses(ctx context.Context, pool *pgxpool.Pool, idUser int64) ([]model.Address, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+addressColumns+`
		FROM saved_address
		WHERE id_user = $1 AND deleted_at IS NULL
		ORDER BY is_default DESC, id`, idUser)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	addresses := []model.Address{}

	for rows.Next() {
		address, err := scanAddress(rows)
		if err != nil {
			return nil, err
		}

		addresses = append(addresses, address)
	}

	return addresses, rows.Err()
}

func CreateAddress(ctx context.Context, pool *pgxpool.Pool, idUser int64, req model.AddressRequest) (model.Address, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return model.Address{}, err
	}
	defer tx.Rollback(ctx)

	if req.IsDefault {
		if _, err := tx.Exec(ctx,
			`UPDATE saved_address SET is_default = FALSE WHERE id_user = $1 AND deleted_at IS NULL`,
			idUser); err != nil {
			return model.Address{}, err
		}
	}

	address, err := scanAddress(tx.QueryRow(ctx,
		`INSERT INTO saved_address (
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
		idUser, req.Label, req.Name, req.Phone, req.Address, req.City, req.Province, req.PostalCode, req.IsDefault))
	if err != nil {
		return model.Address{}, err
	}

	return address, tx.Commit(ctx)
}
