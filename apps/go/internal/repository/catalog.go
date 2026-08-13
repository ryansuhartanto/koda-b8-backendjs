package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
)

func Categories(ctx context.Context, pool *pgxpool.Pool) ([]model.CategoriesSummary, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id,
			name,
			icon,
			img,
			product_count
		FROM categories_summary
		ORDER BY name`)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.CategoriesSummary])
}

func Brands(ctx context.Context, pool *pgxpool.Pool) ([]model.BrandsSummary, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id,
			name,
			product_count
		FROM brands_summary
		ORDER BY name`)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.BrandsSummary])
}

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

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.ShippingMethod])
}

func PaymentMethods(ctx context.Context, pool *pgxpool.Pool) ([]model.PaymentMethod, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id,
			name,
			metadata
		FROM payment_methods
		WHERE is_available AND deleted_at IS NULL
		ORDER BY name`)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.PaymentMethod])
}
