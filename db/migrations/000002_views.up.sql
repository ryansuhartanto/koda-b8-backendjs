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
    ROUND(AVG(r.rating), 1) AS rating,
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
    CASE WHEN cv.url IS NOT NULL THEN p.name END AS img_alt,
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
