package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
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
	id_payment,
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
	ship_note,
	items`

func Orders(ctx context.Context, pool *pgxpool.Pool, idUser int64) ([]model.OrdersSummary, error) {
	// orders_summary already carries the aggregated items, so this is one round trip
	rows, err := pool.Query(ctx,
		`SELECT `+orderColumns+`
		FROM orders_summary
		WHERE id_user = $1
		ORDER BY created_at DESC, id DESC`, idUser)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[model.OrdersSummary])
}

type cartLine struct {
	productName string
	stock       int32
	quantity    int32
}

func CreateOrder(ctx context.Context, pool *pgxpool.Pool, idUser int64, req model.OrderRequest) (model.OrdersSummary, error) {
	var zero model.OrdersSummary

	tx, err := pool.Begin(ctx)
	if err != nil {
		return zero, err
	}
	defer tx.Rollback(ctx)

	var shipName, shipPhone, shipEmail, shipAddress string

	err = tx.QueryRow(ctx,
		`SELECT
			name,
			phone,
			email,
			address
		FROM users_address_shipping
		WHERE id = $1 AND id_user = $2`,
		req.AddressID, idUser,
	).Scan(&shipName, &shipPhone, &shipEmail, &shipAddress)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return zero, &OrderError{http.StatusNotFound, "no such address"}
		}

		return zero, err
	}

	var idPayment int64

	err = tx.QueryRow(ctx,
		`SELECT
			id
		FROM payment_methods
		WHERE id = $1 AND is_available AND deleted_at IS NULL`,
		req.PaymentID).Scan(&idPayment)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return zero, &OrderError{http.StatusNotFound, "no such payment method"}
		}

		return zero, err
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
			return zero, &OrderError{http.StatusNotFound, "no such shipping method"}
		}

		return zero, err
	}

	lines, err := lockCart(ctx, tx, idUser)
	if err != nil {
		return zero, err
	}

	// the stock CHECK names no product, so the readable 409 is raised here
	for _, line := range lines {
		if line.quantity > line.stock {
			return zero, &OrderError{http.StatusConflict, fmt.Sprintf("not enough stock for %s", line.productName)}
		}
	}

	var idOrder int64

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
		FROM cart_summary
		WHERE id_user = $1
		RETURNING id`,
		idUser, idPayment, req.PromoCode, shipCostIdr,
		shipName, shipPhone, shipEmail, shipAddress, req.ShipMethod, req.ShipNote,
	).Scan(&idOrder); err != nil {
		return zero, err
	}

	// data-modifying CTEs run to completion even though nothing is selected from them
	if _, err := tx.Exec(ctx,
		`WITH cart AS MATERIALIZED (
			SELECT
				id_variant,
				name,
				variant_name,
				price_idr,
				quantity
			FROM cart_lines
			WHERE id_user = $2
		),
		inserted AS (
			INSERT INTO orders_items (
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
				variant_name,
				price_idr,
				quantity
			FROM cart
		),
		stock AS (
			UPDATE products_variants pv SET stock = pv.stock - cart.quantity
			FROM cart WHERE cart.id_variant = pv.id
		)
		DELETE FROM cart_items WHERE id_user = $2`,
		idOrder, idUser); err != nil {
		return zero, err
	}

	// RETURNING cannot read a view, so the finished order is read back through the summary
	rows, err := tx.Query(ctx, `SELECT `+orderColumns+` FROM orders_summary WHERE id = $1`, idOrder)
	if err != nil {
		return zero, err
	}

	order, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[model.OrdersSummary])
	if err != nil {
		return zero, err
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
			pv.stock,
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

		if err := rows.Scan(&line.productName, &line.stock, &line.quantity); err != nil {
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
