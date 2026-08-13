package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
)

var ProductSort = map[string]string{
	"newest":     "created_at DESC, id DESC",
	"price_asc":  "price_idr ASC, id ASC",
	"price_desc": "price_idr DESC, id DESC",
	"rating":     "rating DESC NULLS LAST, id DESC",
}

type ProductFilter struct {
	Search   string
	Category string
	Brand    string
	Sort     string
	Limit    int
	Offset   int
}

// the aggregated variants are heavy and a listing never renders them
const productColumns = `
	id,
	created_at,
	updated_at,
	name,
	description,
	brand,
	category,
	urls,
	price_idr,
	original_price_idr,
	stock,
	rating,
	rating_count`

const productDetail = productColumns + `,
	variants`

// embedded so the paginated total rides along without a second round trip
type productRow struct {
	model.ProductsSummary
	Total int `db:"total"`
}

// Products returns one page plus the filter's total across all pages.
func Products(ctx context.Context, pool *pgxpool.Pool, filter ProductFilter) ([]model.ProductsSummary, int, error) {
	query := strings.Builder{}
	// COUNT(*) OVER() carries the unpaginated total on every row, avoiding a second round trip
	query.WriteString(`SELECT ` + productColumns + `, COUNT(*) OVER() AS total
	FROM products_summary`)

	args := []any{}
	where := []string{}

	if filter.Search != "" {
		args = append(args, filter.Search)
		where = append(where, fmt.Sprintf("name ILIKE '%%' || $%d || '%%'", len(args)))
	}

	if filter.Category != "" {
		args = append(args, filter.Category)
		where = append(where, fmt.Sprintf("category = $%d", len(args)))
	}

	if filter.Brand != "" {
		args = append(args, filter.Brand)
		where = append(where, fmt.Sprintf("brand = $%d", len(args)))
	}

	if len(where) > 0 {
		query.WriteString(" WHERE ")
		query.WriteString(strings.Join(where, " AND "))
	}

	args = append(args, filter.Limit, filter.Offset)
	fmt.Fprintf(&query, " ORDER BY %s LIMIT $%d OFFSET $%d", ProductSort[filter.Sort], len(args)-1, len(args))

	rows, err := pool.Query(ctx, query.String(), args...)
	if err != nil {
		return nil, 0, err
	}

	collected, err := pgx.CollectRows(rows, pgx.RowToStructByName[productRow])
	if err != nil {
		return nil, 0, err
	}

	products := make([]model.ProductsSummary, 0, len(collected))
	total := 0

	for _, row := range collected {
		total = row.Total
		products = append(products, row.ProductsSummary)
	}

	return products, total, nil
}

func ProductByID(ctx context.Context, pool *pgxpool.Pool, id int64) (model.ProductsSummary, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+productDetail+`
		FROM products_summary
		WHERE id = $1`, id)
	if err != nil {
		return model.ProductsSummary{}, err
	}

	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[model.ProductsSummary])
}
