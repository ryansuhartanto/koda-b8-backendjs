package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
)

func ShippingMethods(ctx context.Context, pool *pgxpool.Pool) ([]model.ShippingMethod, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id,
			name,
			cost_idr
		FROM shipping_methods
		WHERE deleted_at IS NULL
		ORDER BY cost_idr, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	methods := []model.ShippingMethod{}

	for rows.Next() {
		var method model.ShippingMethod

		if err := rows.Scan(
			&method.ID,
			&method.Name,
			&method.CostIdr,
		); err != nil {
			return nil, err
		}

		methods = append(methods, method)
	}

	return methods, rows.Err()
}
