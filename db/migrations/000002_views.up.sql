CREATE VIEW products_cheapest AS
SELECT DISTINCT ON (pv.id_product)
    pv.id_product,
    pv.id AS id_variant,
    pp.price_idr,
    pp.original_price_idr
FROM products_variants pv
JOIN products_price pp ON pp.id_variant = pv.id
WHERE pv.deleted_at IS NULL
ORDER BY pv.id_product, pp.price_idr, pv.position, pv.id;

CREATE VIEW products_stock AS
SELECT
    id_product,
    SUM(inventory) AS inventory
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
SELECT DISTINCT ON (id_product)
    id_product,
    url
FROM products_images
WHERE id_variant IS NULL
ORDER BY id_product, id;

CREATE VIEW products_variants_cover AS
SELECT DISTINCT ON (pi.id_variant)
    pi.id_variant,
    pi.url
FROM products_images pi
JOIN products_variants pv
    ON pi.id_product = pv.id_product AND pi.id_variant = pv.id
WHERE pv.deleted_at IS NULL
ORDER BY pi.id_variant, pi.id;

CREATE VIEW products_variants_priced AS
SELECT
    pv.id,
    pv.id_product,
    pv.position,
    pv.name,
    pv.description,
    pv.inventory,
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

CREATE VIEW products_summary AS
SELECT
    p.id,
    p.created_at,
    p.updated_at,
    p.name,
    p.description,
    b.name AS brand,
    c.name AS category,
    cv.url AS img_url,
    pc.price_idr,
    pc.original_price_idr,
    COALESCE(ps.inventory, 0) AS inventory,
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
    pv.name AS name_variant,
    pvc.url AS img_url,
    CASE WHEN pvc.url IS NOT NULL THEN concat_ws(' ', p.name, pv.name) END AS img_alt,
    pp.price_idr,
    pp.original_price_idr,
    pv.inventory,
    ci.quantity
FROM cart_items ci
JOIN products_variants pv ON pv.id = ci.id_variant AND pv.deleted_at IS NULL
JOIN products p ON p.id = pv.id_product AND p.deleted_at IS NULL
JOIN products_price pp ON pp.id_variant = pv.id
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
    a.address
FROM saved_address a
JOIN users u ON u.id = a.id_user
WHERE a.deleted_at IS NULL;

CREATE VIEW orders_summary AS
SELECT
    id,
    id_user,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
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
    ship_note
FROM orders
WHERE deleted_at IS NULL;
