package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
)

type OrderError struct {
	Status int
	Detail string
}

func (e *OrderError) Error() string { return e.Detail }

const orderColumns = `
	id,
	created_at,
	status,
	payment_method,
	promo_code,
	discount_idr,
	subtotal_idr,
	ship_cost_idr,
	total_idr,
	ship_name,
	ship_phone,
	ship_email,
	ship_address,
	ship_method,
	ship_note`

func scanOrder(row pgx.Row) (model.Order, error) {
	var (
		o         model.Order
		createdAt time.Time
	)

	err := row.Scan(
		&o.ID,
		&createdAt,
		&o.Status,
		&o.PaymentMethod,
		&o.PromoCode,
		&o.DiscountIdr,
		&o.SubtotalIdr,
		&o.ShipCostIdr,
		&o.TotalIdr,
		&o.ShipName,
		&o.ShipPhone,
		&o.ShipEmail,
		&o.ShipAddress,
		&o.ShipMethod,
		&o.ShipNote,
	)
	if err != nil {
		return o, err
	}

	// RFC3339 carries no fractional seconds, which is what keeps this identical to the JS service
	o.CreatedAt = createdAt.UTC().Format(time.RFC3339)

	return o, nil
}

func Orders(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, idUser int64) ([]model.Order, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+orderColumns+`
		FROM orders_summary
		WHERE id_user = $1
		ORDER BY created_at DESC, id DESC`, idUser)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []model.Order{}
	ids := []int64{}

	for rows.Next() {
		order, err := scanOrder(rows)
		if err != nil {
			return nil, err
		}

		order.Items = []model.OrderItem{}
		orders = append(orders, order)
		ids = append(ids, order.ID)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	items, err := orderItems(ctx, pool, codec, ids)
	if err != nil {
		return nil, err
	}

	for i := range orders {
		if lines, ok := items[orders[i].ID]; ok {
			orders[i].Items = lines
		}
	}

	return orders, nil
}

func orderItems(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, idOrders []int64) (map[int64][]model.OrderItem, error) {
	items := map[int64][]model.OrderItem{}

	if len(idOrders) == 0 {
		return items, nil
	}

	rows, err := pool.Query(ctx,
		`SELECT
			id_order,
			id,
			id_variant,
			product_name,
			variant_name,
			unit_price_idr,
			quantity
		FROM order_items
		WHERE id_order = ANY($1)
		ORDER BY id`, idOrders)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			idOrder   int64
			idVariant *int64
			item      model.OrderItem
		)

		if err := rows.Scan(
			&idOrder,
			&item.ID,
			&idVariant,
			&item.ProductName,
			&item.VariantName,
			&item.UnitPriceIdr,
			&item.Quantity,
		); err != nil {
			return nil, err
		}

		if item.IDVariant, err = variantSqid(codec, idVariant); err != nil {
			return nil, err
		}

		items[idOrder] = append(items[idOrder], item)
	}

	return items, rows.Err()
}

func variantSqid(codec *sqid.Codec, idVariant *int64) (string, error) {
	if idVariant == nil {
		return "", nil
	}

	return codec.Encode(*idVariant)
}

type cartLine struct {
	productName string
	inventory   int
	quantity    int
}

func CreateOrder(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, idUser int64, req model.OrderRequest) (model.Order, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return model.Order{}, err
	}
	defer tx.Rollback(ctx)

	var shipName, shipPhone, shipEmail, shipAddress string

	err = tx.QueryRow(ctx,
		`SELECT
			name,
			phone,
			email,
			address
		FROM saved_address_shipping
		WHERE id = $1 AND id_user = $2`,
		req.IDAddress, idUser,
	).Scan(
		&shipName,
		&shipPhone,
		&shipEmail,
		&shipAddress,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Order{}, &OrderError{http.StatusNotFound, "no such address"}
		}

		return model.Order{}, err
	}

	var shipCostIdr int64

	err = tx.QueryRow(ctx,
		`SELECT
			cost_idr
		FROM shipping_methods
		WHERE name = $1 AND deleted_at IS NULL`,
		req.ShipMethod).Scan(&shipCostIdr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Order{}, &OrderError{http.StatusNotFound, "no such shipping method"}
		}

		return model.Order{}, err
	}

	lines, err := lockCart(ctx, tx, idUser)
	if err != nil {
		return model.Order{}, err
	}

	// the inventory CHECK names no product, so the readable 409 is raised here
	for _, line := range lines {
		if line.quantity > line.inventory {
			return model.Order{}, &OrderError{http.StatusConflict, fmt.Sprintf("not enough stock for %s", line.productName)}
		}
	}

	var idOrder int64

	// RETURNING cannot read a view, so the row is read back through orders_summary
	if err := tx.QueryRow(ctx,
		`INSERT INTO orders (
			id_user,
			payment_method,
			promo_code,
			discount_idr,
			subtotal_idr,
			ship_cost_idr,
			ship_name,
			ship_phone,
			ship_email,
			ship_address,
			ship_method,
			ship_note
		)
		SELECT
			$1,
			$2,
			NULLIF($3, ''),
			0,
			subtotal_idr,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			NULLIF($10, '')
		FROM cart_totals
		WHERE id_user = $1
		RETURNING id`,
		idUser, req.PaymentMethod, req.PromoCode, shipCostIdr,
		shipName, shipPhone, shipEmail, shipAddress, req.ShipMethod, req.ShipNote,
	).Scan(&idOrder); err != nil {
		return model.Order{}, err
	}

	order, err := scanOrder(tx.QueryRow(ctx,
		`SELECT `+orderColumns+` FROM orders_summary WHERE id = $1`, idOrder))
	if err != nil {
		return model.Order{}, err
	}

	order.Items = []model.OrderItem{}

	// data-modifying CTEs run to completion even though only `inserted` is selected from
	rows, err := tx.Query(ctx,
		`WITH cart AS MATERIALIZED (
			SELECT
				id_variant,
				name,
				name_variant,
				price_idr,
				quantity
			FROM cart_lines
			WHERE id_user = $2
		),
		inserted AS (
			INSERT INTO order_items (
				id_order,
				id_variant,
				product_name,
				variant_name,
				unit_price_idr,
				quantity
			)
			SELECT
				$1,
				id_variant,
				name,
				name_variant,
				price_idr,
				quantity
			FROM cart
			RETURNING
				id,
				id_variant,
				product_name,
				variant_name,
				unit_price_idr,
				quantity
		),
		stock AS (
			UPDATE products_variants pv SET inventory = pv.inventory - cart.quantity
			FROM cart WHERE cart.id_variant = pv.id
		),
		cleared AS (
			DELETE FROM cart_items WHERE id_user = $2
		)
		SELECT
			id,
			id_variant,
			product_name,
			variant_name,
			unit_price_idr,
			quantity
		FROM inserted
		ORDER BY id`,
		idOrder, idUser)
	if err != nil {
		return model.Order{}, err
	}

	for rows.Next() {
		var (
			item      model.OrderItem
			idVariant *int64
		)

		if err := rows.Scan(
			&item.ID,
			&idVariant,
			&item.ProductName,
			&item.VariantName,
			&item.UnitPriceIdr,
			&item.Quantity,
		); err != nil {
			rows.Close()
			return model.Order{}, err
		}

		if item.IDVariant, err = variantSqid(codec, idVariant); err != nil {
			rows.Close()
			return model.Order{}, err
		}

		order.Items = append(order.Items, item)
	}

	rows.Close()

	if err := rows.Err(); err != nil {
		return model.Order{}, err
	}

	return order, tx.Commit(ctx)
}

func lockCart(ctx context.Context, tx pgx.Tx, idUser int64) ([]cartLine, error) {
	// base tables rather than cart_lines, since FOR UPDATE cannot target a view's join
	// ordered by id so that two checkouts touching the same variants take the row locks in
	// the same sequence and cannot deadlock
	rows, err := tx.Query(ctx,
		`SELECT
			p.name,
			pv.inventory,
			ci.quantity
		FROM cart_items ci
		JOIN products_variants pv ON pv.id = ci.id_variant AND pv.deleted_at IS NULL
		JOIN products p ON p.id = pv.id_product AND p.deleted_at IS NULL
		WHERE ci.id_user = $1
		ORDER BY pv.id
		FOR UPDATE OF pv`, idUser)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lines := []cartLine{}

	for rows.Next() {
		var line cartLine

		if err := rows.Scan(
			&line.productName,
			&line.inventory,
			&line.quantity,
		); err != nil {
			return nil, err
		}

		lines = append(lines, line)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(lines) == 0 {
		return nil, &OrderError{http.StatusConflict, "cart is empty"}
	}

	return lines, nil
}
