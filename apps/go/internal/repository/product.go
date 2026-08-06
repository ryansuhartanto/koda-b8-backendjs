package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/model"
	"github.com/ryansuhartanto/koda-b8-backend/apps/go/internal/sqid"
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

const productColumns = `
	id,
	name,
	COALESCE(description, ''),
	COALESCE(brand, ''),
	COALESCE(category, ''),
	COALESCE(img_url, ''),
	COALESCE(img_alt, ''),
	price_idr,
	original_price_idr,
	inventory,
	COALESCE(rating, 0)::FLOAT,
	rating_count`

func scanProduct(row pgx.Row, codec *sqid.Codec, extra ...any) (model.Product, error) {
	var (
		p  model.Product
		id int64
	)

	err := row.Scan(append([]any{
		&id, &p.Name, &p.Description,
		&p.Brand, &p.Category, &p.ImgURL, &p.ImgAlt,
		&p.PriceIdr, &p.OriginalPriceIdr,
		&p.Inventory,
		&p.Rating, &p.RatingCount,
	}, extra...)...)
	if err != nil {
		return p, err
	}

	if p.ID, err = codec.Encode(id); err != nil {
		return p, err
	}

	p.Path = model.ProductPath(p.ID, p.Name)

	return p, nil
}

// Products returns one page plus the filter's total across all pages.
func Products(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, filter ProductFilter) ([]model.Product, int, error) {
	query := strings.Builder{}
	// COUNT(*) OVER() carries the unpaginated total on every row, avoiding a second round trip
	query.WriteString(`SELECT ` + productColumns + `, COUNT(*) OVER()
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
	defer rows.Close()

	products := []model.Product{}
	total := 0

	for rows.Next() {
		p, err := scanProduct(rows, codec, &total)
		if err != nil {
			return nil, 0, err
		}

		products = append(products, p)
	}

	return products, total, rows.Err()
}

func ProductByID(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, id int64) (model.Product, error) {
	p, err := scanProduct(pool.QueryRow(ctx, `SELECT `+productColumns+`
	FROM products_summary
	WHERE id = $1`, id), codec)
	if err != nil {
		return p, err
	}

	p.Variants, err = productVariants(ctx, pool, codec, id)

	return p, err
}

func productVariants(ctx context.Context, pool *pgxpool.Pool, codec *sqid.Codec, id int64) ([]model.ProductVariant, error) {
	rows, err := pool.Query(ctx, `
		SELECT pv.id, pv.name, COALESCE(pv.description, ''), pv.inventory, pp.price_idr, pp.original_price_idr
		FROM products_variants pv
		JOIN products_price pp ON pp.id_variant = pv.id
		WHERE pv.id_product = $1 AND pv.deleted_at IS NULL
		ORDER BY pv.position ASC, pv.id ASC`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	variants := []model.ProductVariant{}

	for rows.Next() {
		var (
			v       model.ProductVariant
			variant int64
		)

		if err := rows.Scan(&variant, &v.Name, &v.Description, &v.Inventory, &v.PriceIdr, &v.OriginalPriceIdr); err != nil {
			return nil, err
		}

		if v.ID, err = codec.Encode(variant); err != nil {
			return nil, err
		}

		variants = append(variants, v)
	}

	return variants, rows.Err()
}
