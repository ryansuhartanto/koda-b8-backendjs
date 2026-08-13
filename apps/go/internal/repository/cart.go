package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
)

func Cart(ctx context.Context, pool *pgxpool.Pool, idUser int64) (model.CartSummary, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			subtotal_idr,
			items
		FROM cart_summary
		WHERE id_user = $1`, idUser)
	if err != nil {
		return model.CartSummary{}, err
	}

	cart, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[model.CartSummary])

	// the view groups cart_items, so an empty cart has no row at all
	if errors.Is(err, pgx.ErrNoRows) {
		return model.CartSummary{Items: []model.CartItem{}}, nil
	}

	return cart, err
}

// SELECT rather than a literal id, so a soft-deleted variant is rejected with no
// check-then-insert window
func SetCartItem(ctx context.Context, pool *pgxpool.Pool, idUser, idVariant int64, quantity int32) (bool, error) {
	tag, err := pool.Exec(ctx,
		`INSERT INTO cart_items (
			id_user,
			id_variant,
			quantity
		)
		SELECT
			$1,
			id,
			$3
		FROM products_variants_sellable
		WHERE id = $2
		ON CONFLICT (id_user, id_variant) DO UPDATE SET quantity = EXCLUDED.quantity`,
		idUser, idVariant, quantity)

	return tag.RowsAffected() > 0, err
}

func DeleteCartItem(ctx context.Context, pool *pgxpool.Pool, idUser, idVariant int64) (bool, error) {
	tag, err := pool.Exec(ctx,
		`DELETE FROM cart_items WHERE id_user = $1 AND id_variant = $2`, idUser, idVariant)

	return tag.RowsAffected() > 0, err
}
