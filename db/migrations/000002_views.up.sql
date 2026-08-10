CREATE VIEW products_stock AS
SELECT
	id_product,
	SUM(stock) AS stock
FROM products_variants
WHERE deleted_at IS NULL
GROUP BY id_product;

CREATE VIEW products_ratings AS
SELECT
	pv.id_product,
	ROUND(AVG(r.rating), 1)::FLOAT AS rating,
	COUNT(*) AS rating_count
FROM ratings r
JOIN products_variants pv ON r.id_variant = pv.id
WHERE r.deleted_at IS NULL AND pv.deleted_at IS NULL
GROUP BY pv.id_product;

CREATE VIEW products_cover AS
SELECT DISTINCT ON (pi.id_product)
	pi.id_product,
	pi.url
FROM products_images pi
JOIN products_variants pv ON pi.id_variant = pv.id
WHERE pv.deleted_at IS NULL
ORDER BY pi.id_product, pi.position;

CREATE VIEW products_variants_cover AS
SELECT DISTINCT ON (pi.id_variant)
	pi.id_variant,
	pi.url
FROM products_images pi
JOIN products_variants pv ON pi.id_variant = pv.id
WHERE pv.deleted_at IS NULL
ORDER BY pi.id_variant, pi.position;

CREATE VIEW products_variants_priced AS
SELECT
	pv.id,
	pv.id_product,
	pv.sku,
	pv.stock,
	pp.price_idr,
	pp.original_price_idr
FROM products_variants pv
JOIN products_price pp ON pp.id_variant = pv.id
WHERE pv.deleted_at IS NULL;

CREATE VIEW products_variants_sellable AS
SELECT
	pv.id,
	pv.id_product
FROM products_variants pv
JOIN products p ON p.id = pv.id_product AND p.deleted_at IS NULL
WHERE pv.deleted_at IS NULL;

CREATE VIEW products_cheapest AS
SELECT DISTINCT ON (pv.id_product)
	pv.id_product,
	pv.id AS id_variant,
	pp.price_idr,
	pp.original_price_idr
FROM products_variants pv
JOIN products_price pp ON pp.id_variant = pv.id
WHERE pv.deleted_at IS NULL
ORDER BY pv.id_product, pp.price_idr, pv.id;

CREATE VIEW products_variants_options_resolved AS
SELECT
    pvo.id_variant,
    po.id_product,
    po.tier,
    po.name AS option_name,
    pov.name AS value_name,
    pov.description AS value_description
FROM products_variants_options pvo
JOIN products_options_values pov ON pvo.id_value = pov.id
JOIN products_options po ON pov.id_option = po.id
WHERE pov.deleted_at IS NULL AND po.deleted_at IS NULL
ORDER BY pvo.id_variant, po.tier;

CREATE VIEW products_variants_labeled AS
SELECT
	id_variant,
	string_agg(value_name, ' / ' ORDER BY tier) AS name
FROM products_variants_options_resolved
GROUP BY id_variant;

CREATE VIEW products_summary AS
SELECT
	p.id,
	p.created_at,
	p.updated_at,
	p.name,
	p.description,
	b.name AS brand,
	c.name AS category,
	cv.url AS img,
	pc.price_idr,
	pc.original_price_idr,
	COALESCE(ps.stock, 0) AS stock,
	r.rating,
	COALESCE(r.rating_count, 0) AS rating_count
FROM products p
LEFT JOIN categories c ON c.id = p.id_category AND c.deleted_at IS NULL
LEFT JOIN brands b ON b.id = p.id_brand AND b.deleted_at IS NULL
JOIN products_cheapest pc ON pc.id_product = p.id
LEFT JOIN products_stock ps ON ps.id_product = p.id
LEFT JOIN products_ratings r ON r.id_product = p.id
LEFT JOIN products_cover cv ON cv.id_product = p.id
WHERE p.deleted_at IS NULL;

CREATE VIEW cart_lines AS
SELECT
	ci.id_user,
	ci.created_at,
	ci.id_variant,
	pv.id_product,
	p.name,
	pvl.name AS name_variant,
	pv.sku,
	pvc.url AS img,
	pp.price_idr,
	pp.original_price_idr,
	pv.stock AS inventory,
	ci.quantity
FROM cart_items ci
JOIN products_variants pv ON pv.id = ci.id_variant AND pv.deleted_at IS NULL
JOIN products p ON p.id = pv.id_product AND p.deleted_at IS NULL
JOIN products_price pp ON pp.id_variant = pv.id
LEFT JOIN products_variants_labeled pvl ON pvl.id_variant = pv.id
LEFT JOIN products_variants_cover pvc ON pvc.id_variant = pv.id;

CREATE VIEW cart_totals AS
SELECT
	id_user,
	SUM(price_idr * quantity) AS subtotal_idr
FROM cart_lines
GROUP BY id_user;

CREATE VIEW saved_address_shipping AS
SELECT
	a.id,
	a.id_user,
	a.name,
	a.phone,
	u.email,
	CONCAT_WS(E'\n',
		a.address,
		a.city,
		CONCAT_WS(' ', a.province, a.postal_code)
	) as address
FROM saved_address a
JOIN users u ON u.id = a.id_user
WHERE a.deleted_at IS NULL;
