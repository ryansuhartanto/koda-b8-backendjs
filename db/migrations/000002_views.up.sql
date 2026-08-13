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

CREATE VIEW products_gallery AS
SELECT
  id_product,
  ARRAY_AGG(url ORDER BY position) AS urls
FROM products_images
GROUP BY id_product;

CREATE VIEW products_variants_gallery AS
SELECT
  pi.id_variant,
  ARRAY_AGG(pi.url ORDER BY pi.position) AS urls
FROM products_images pi
JOIN products_variants pv ON pi.id_variant = pv.id
WHERE pv.deleted_at IS NULL
GROUP BY pi.id_variant;

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
	JSON_AGG(
		JSON_BUILD_OBJECT(
			'option', option_name,
			'value', value_name
		) ORDER BY tier
	) AS options
FROM products_variants_options_resolved
GROUP BY id_variant;

CREATE VIEW products_variants_agg AS
SELECT
	id_product,
	JSON_AGG(
		JSON_BUILD_OBJECT(
			'id', pvp.id,
			'sku', pvp.sku,
			'stock', pvp.stock,
			'price_idr', pvp.price_idr,
			'original_price_idr', pvp.original_price_idr,
			'options', COALESCE(pvl.options, '[]'::json)
		) ORDER BY pvp.id
	) AS variants
FROM products_variants_priced pvp
LEFT JOIN products_variants_labeled pvl ON pvl.id_variant = pvp.id
GROUP BY pvp.id_product;

CREATE VIEW products_summary AS
SELECT
	p.id,
	p.created_at,
	p.updated_at,
	p.name,
	p.description,
	b.name AS brand,
	c.name AS category,
	pg.urls,
	pc.price_idr,
	pc.original_price_idr,
	COALESCE(ps.stock, 0) AS stock,
	r.rating,
	COALESCE(r.rating_count, 0) AS rating_count,
	pvg.variants
FROM products p
LEFT JOIN categories c ON c.id = p.id_category AND c.deleted_at IS NULL
LEFT JOIN brands b ON b.id = p.id_brand AND b.deleted_at IS NULL
JOIN products_cheapest pc ON pc.id_product = p.id
LEFT JOIN products_stock ps ON ps.id_product = p.id
LEFT JOIN products_ratings r ON r.id_product = p.id
LEFT JOIN products_gallery pg ON pg.id_product = p.id
LEFT JOIN products_variants_agg pvg ON pvg.id_product = p.id
WHERE p.deleted_at IS NULL;

CREATE VIEW cart_lines AS
SELECT
	ci.id_user,
	ci.created_at,
	ci.id_variant,
	pv.id_product,
	p.name,
	pvl.options AS variant_options,
	pv.sku,
	pvg.urls,
	pp.price_idr,
	pp.original_price_idr,
	pv.stock AS inventory,
	ci.quantity
FROM cart_items ci
JOIN products_variants pv ON pv.id = ci.id_variant AND pv.deleted_at IS NULL
JOIN products p ON p.id = pv.id_product AND p.deleted_at IS NULL
JOIN products_price pp ON pp.id_variant = pv.id
LEFT JOIN products_variants_labeled pvl ON pvl.id_variant = pv.id
LEFT JOIN products_variants_gallery pvg ON pvg.id_variant = pv.id;

CREATE VIEW cart_summary AS
SELECT
	id_user,
	SUM(price_idr * quantity)::BIGINT AS subtotal_idr,
	JSON_AGG(
		JSON_BUILD_OBJECT(
			'id_variant', id_variant,
			'id_product', id_product,
			'name', name,
			'variant_options', variant_options,
			'sku', sku,
			'urls', urls,
			'price_idr', price_idr,
			'original_price_idr', original_price_idr,
			'inventory', inventory,
			'quantity', quantity,
			'created_at', created_at
		) ORDER BY created_at
	) AS items
FROM cart_lines
GROUP BY id_user;

CREATE VIEW orders_items_agg AS
SELECT
	id_order,
	JSON_AGG(
		JSON_BUILD_OBJECT(
			'id', id,
			'id_variant', id_variant,
			'product_name', product_name,
			'variant_name', variant_name,
			'unit_price_idr', unit_price_idr,
			'quantity', quantity
		) ORDER BY id
	) AS items
FROM orders_items
GROUP BY id_order;

CREATE VIEW orders_summary AS
SELECT
	o.id,
	o.id_user,
	o.created_at,
	o.status,
	o.payment_method,
	o.promo_code,
	o.discount_idr,
	o.subtotal_idr,
	o.ship_cost_idr,
	o.total_idr,
	o.ship_name,
	o.ship_phone,
	o.ship_email,
	o.ship_address,
	o.ship_method,
	o.ship_note,
	COALESCE(oia.items, '[]'::json) AS items
FROM orders o
LEFT JOIN orders_items_agg oia ON oia.id_order = o.id
WHERE o.deleted_at IS NULL;

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
