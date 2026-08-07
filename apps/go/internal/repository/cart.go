package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

func CartItems(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, idUser int64) ([]model.CartItem, error) {
	rows, err := pool.Query(ctx,
		`SELECT
			id_variant,
			id_product,
			name,
			name_variant,
			img,
			price_idr,
			original_price_idr,
			quantity
		FROM cart_lines
		WHERE id_user = $1
		ORDER BY created_at, id_variant`, idUser)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []model.CartItem{}

	for rows.Next() {
		var (
			item      model.CartItem
			idVariant int64
			idProduct int64
		)

		if err := rows.Scan(
			&idVariant,
			&idProduct,
			&item.Name,
			&item.NameVariant,
			&item.Img,
			&item.PriceIdr,
			&item.OriginalPriceIdr,
			&item.Quantity,
		); err != nil {
			return nil, err
		}

		if item.IDVariant, err = codec.Encode(idVariant); err != nil {
			return nil, err
		}

		product, err := codec.Encode(idProduct)
		if err != nil {
			return nil, err
		}

		item.Path = model.ProductPath(product, item.Name)

		items = append(items, item)
	}

	return items, rows.Err()
}

// SELECT rather than a literal id, so a soft-deleted variant is rejected with no
// check-then-insert window
func SetCartItem(ctx context.Context, pool *pgxpool.Pool, idUser, idVariant int64, quantity int) (bool, error) {
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
