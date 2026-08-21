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

type productRow struct {
	model.ProductsSummary
	Total int `db:"total"`
}

func Products(ctx context.Context, pool *pgxpool.Pool, filter ProductFilter) ([]model.ProductsSummary, int, error) {
	query := strings.Builder{}
	// COUNT(*) OVER() carries the total on every row, so no second round trip
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

	// Lax: a listing omits variants, and strict scanning rejects a field with no column
	collected, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[productRow])
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

func CreateProduct(ctx context.Context, pool *pgxpool.Pool, req model.ProductRequest) (model.ProductsSummary, error) {
	var zero model.ProductsSummary

	tx, err := pool.Begin(ctx)
	if err != nil {
		return zero, err
	}
	defer tx.Rollback(ctx)

	var idProduct int64

	if err := tx.QueryRow(ctx,
		`INSERT INTO products (
			name,
			description,
			id_category,
			id_brand
		)
		VALUES (
			$1,
			NULLIF($2, ''),
			$3,
			$4
		)
		RETURNING id`,
		req.Name, req.Description, req.CategoryID, req.BrandID,
	).Scan(&idProduct); err != nil {
		return zero, err
	}

	var idVariant int64

	// products_variants.price is vestigial: every view reads products_price instead
	if err := tx.QueryRow(ctx,
		`INSERT INTO products_variants (
			id_product,
			sku,
			price,
			stock
		)
		VALUES (
			$1,
			NULLIF($2, ''),
			$3,
			$4
		)
		RETURNING id`,
		idProduct, req.SKU, req.OriginalPriceIDR, req.Stock,
	).Scan(&idVariant); err != nil {
		return zero, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO products_price (
			id_variant,
			original_price_idr,
			discount_price_idr
		)
		VALUES (
			$1,
			$2,
			$3
		)`,
		idVariant, req.OriginalPriceIDR, req.DiscountPriceIDR); err != nil {
		return zero, err
	}

	// WITH ORDINALITY numbers the gallery, which is unique per product
	if _, err := tx.Exec(ctx,
		`INSERT INTO products_images (
			id_product,
			id_variant,
			position,
			url
		)
		SELECT
			$1,
			$2,
			ordinality - 1,
			url
		FROM UNNEST($3::TEXT[]) WITH ORDINALITY AS image(url, ordinality)`,
		idProduct, idVariant, req.URLs); err != nil {
		return zero, err
	}

	// RETURNING cannot read a view, so the product is read back through the summary
	rows, err := tx.Query(ctx, `SELECT `+productDetail+` FROM products_summary WHERE id = $1`, idProduct)
	if err != nil {
		return zero, err
	}

	product, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[model.ProductsSummary])
	if err != nil {
		return zero, err
	}

	return product, tx.Commit(ctx)
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
