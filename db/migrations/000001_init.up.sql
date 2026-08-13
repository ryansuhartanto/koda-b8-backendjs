CREATE TYPE user_role AS ENUM ('customer', 'admin');

CREATE TYPE order_status AS ENUM ('pending', 'packed', 'shipped', 'delivered', 'cancelled');

CREATE TYPE gender AS ENUM ('M', 'F', 'X');

CREATE TABLE users (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	email VARCHAR NOT NULL,
	password_hash VARCHAR NOT NULL
);

CREATE UNIQUE INDEX users_email_key
ON users (email)
WHERE deleted_at IS NULL;

CREATE TABLE roles (
	id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	role user_role NOT NULL,
	PRIMARY KEY (id_user, role),

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ
);

CREATE TABLE profile (
	id_user BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

	name VARCHAR NOT NULL,

	phone VARCHAR,
	birthdate DATE,
	gender gender,
	avatar VARCHAR
);

CREATE TABLE categories (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	name VARCHAR NOT NULL,
	icon VARCHAR,
	img VARCHAR
);

CREATE UNIQUE INDEX categories_name_key
ON categories (name)
WHERE deleted_at IS NULL;

CREATE TABLE brands (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	name VARCHAR NOT NULL
);

CREATE UNIQUE INDEX brands_name_key
ON brands (name)
WHERE deleted_at IS NULL;

CREATE TABLE products (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_category BIGINT REFERENCES categories (id),
	id_brand BIGINT REFERENCES brands (id),

	name VARCHAR NOT NULL,
	description VARCHAR
);

CREATE INDEX products_id_category_idx
ON products (id_category);

CREATE INDEX products_id_brand_idx
ON products (id_brand);

CREATE TABLE products_options (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,

	tier INT NOT NULL,
	name VARCHAR NOT NULL
);

CREATE UNIQUE INDEX products_options_tier_key
ON products_options (id_product, tier)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX products_options_name_key
ON products_options (id_product, name)
WHERE deleted_at IS NULL;

CREATE INDEX products_options_id_product_idx
ON products_options (id_product);

CREATE TABLE products_options_values (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_option BIGINT NOT NULL REFERENCES products_options (id) ON DELETE CASCADE,

	name VARCHAR NOT NULL,
	description VARCHAR
);

CREATE UNIQUE INDEX products_options_values_name_key
ON products_options_values (id_option, name)
WHERE deleted_at IS NULL;

CREATE INDEX products_options_values_id_option_idx
ON products_options_values (id_option);

CREATE TABLE products_variants (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
	UNIQUE (id, id_product),

	sku VARCHAR,
	price BIGINT NOT NULL CHECK (price >= 0),
	stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE UNIQUE INDEX products_variants_sku_key
ON products_variants (sku)
WHERE deleted_at IS NULL;

CREATE INDEX products_variants_id_product_idx
ON products_variants (id_product);

CREATE TABLE products_variants_options (
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

	id_variant BIGINT NOT NULL REFERENCES products_variants (id) ON DELETE CASCADE,
	id_value BIGINT NOT NULL REFERENCES products_options_values (id) ON DELETE RESTRICT,

	PRIMARY KEY (id_variant, id_value)
);

CREATE INDEX products_variants_options_id_value_idx
ON products_variants_options (id_value);

CREATE TABLE products_images (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
	id_variant BIGINT,
	FOREIGN KEY (id_variant, id_product)
		REFERENCES products_variants (id, id_product) ON DELETE CASCADE,

	position INT NOT NULL,
	url VARCHAR NOT NULL
);

CREATE UNIQUE INDEX products_images_position_key
ON products_images (id_product, position);

CREATE INDEX products_images_id_product_idx
ON products_images (id_product);

CREATE INDEX products_images_id_variant_idx
ON products_images (id_variant);

CREATE TABLE products_price (
	id_variant BIGINT PRIMARY KEY REFERENCES products_variants (id) ON DELETE CASCADE,

	original_price_idr BIGINT NOT NULL,
	discount_price_idr BIGINT CHECK (discount_price_idr < original_price_idr),
	price_idr BIGINT NOT NULL GENERATED ALWAYS AS (COALESCE(discount_price_idr, original_price_idr)) STORED
);

CREATE TABLE ratings (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	id_variant BIGINT NOT NULL REFERENCES products_variants (id) ON DELETE CASCADE,

	rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
	description VARCHAR
);

CREATE TABLE payment_methods (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

	name VARCHAR NOT NULL,
	is_available BOOLEAN NOT NULL DEFAULT TRUE,

	metadata JSON NOT NULL
);

CREATE UNIQUE INDEX payment_methods_name_key
ON payment_methods (name)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ratings_id_user_id_variant_key
ON ratings (id_user, id_variant)
WHERE deleted_at IS NULL;

CREATE INDEX ratings_id_variant_idx
ON ratings (id_variant);

CREATE TABLE users_address (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

	label VARCHAR NOT NULL,
	name VARCHAR NOT NULL,
	phone VARCHAR NOT NULL,
	address VARCHAR NOT NULL,
	city VARCHAR NOT NULL,
	province VARCHAR NOT NULL,
	postal_code VARCHAR NOT NULL,
	is_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX users_address_default_key
ON users_address (id_user)
WHERE deleted_at IS NULL AND is_default;

CREATE INDEX users_address_id_user_idx
ON users_address (id_user);

CREATE TABLE users_payments (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_payment BIGINT NOT NULL REFERENCES payment_methods (id) ON DELETE CASCADE,
	id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

	is_default BOOLEAN NOT NULL DEFAULT FALSE,

	data JSON NOT NULL
);

CREATE UNIQUE INDEX users_payments_default_key
ON users_payments (id_user)
WHERE is_default AND deleted_at IS NULL;

CREATE INDEX users_payments_id_payment_idx
ON users_payments (id_payment);

CREATE INDEX users_payments_id_user_idx
ON users_payments (id_user);

CREATE TABLE cart_items (
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

	id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	id_variant BIGINT NOT NULL REFERENCES products_variants (id) ON DELETE CASCADE,
	PRIMARY KEY (id_user, id_variant),

	quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX cart_items_id_variant_idx
ON cart_items (id_variant);

CREATE TABLE wishlist_items (
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

	id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
	PRIMARY KEY (id_user, id_product)
);

CREATE INDEX wishlist_items_id_product_idx
ON wishlist_items (id_product);

CREATE TABLE shipping_methods (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	name VARCHAR NOT NULL,
	cost_idr BIGINT NOT NULL
);

CREATE UNIQUE INDEX shipping_methods_name_key
ON shipping_methods (name)
WHERE deleted_at IS NULL;

CREATE TABLE orders (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,

	id_user BIGINT NOT NULL REFERENCES users (id),

	status order_status NOT NULL DEFAULT 'pending',

	payment_method BIGINT NOT NULL REFERENCES payment_methods (id),

	promo_code VARCHAR,
	discount_idr BIGINT NOT NULL DEFAULT 0,
	subtotal_idr BIGINT NOT NULL,
	ship_cost_idr BIGINT NOT NULL DEFAULT 0,
	total_idr BIGINT NOT NULL GENERATED ALWAYS AS (subtotal_idr - discount_idr + ship_cost_idr) STORED,

	ship_name VARCHAR NOT NULL,
	ship_phone VARCHAR NOT NULL,
	ship_email VARCHAR NOT NULL,
	ship_address VARCHAR NOT NULL,
	ship_method VARCHAR NOT NULL,
	ship_note VARCHAR
);

CREATE INDEX orders_id_user_idx
ON orders (id_user);

CREATE TABLE orders_items (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

	id_order BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	id_variant BIGINT REFERENCES products_variants (id) ON DELETE SET NULL,

	product_name VARCHAR NOT NULL,
	variant_name VARCHAR,
	unit_price_idr BIGINT NOT NULL,
	quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX orders_items_id_order_idx
ON orders_items (id_order);

CREATE INDEX orders_items_id_variant_idx
ON orders_items (id_variant);

--

CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
		NEW.updated_at = CURRENT_TIMESTAMP;
		RETURN NEW;
	ELSE
		RETURN OLD;
	END IF;
END;
$$ language plpgsql;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER brands_updated_at
BEFORE UPDATE ON brands
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER products_options_updated_at
BEFORE UPDATE ON products_options
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER products_options_values_updated_at
BEFORE UPDATE ON products_options_values
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER products_variants_updated_at
BEFORE UPDATE ON products_variants
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER payment_methods_updated_at
BEFORE UPDATE ON payment_methods
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER ratings_updated_at
BEFORE UPDATE ON ratings
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER users_address_updated_at
BEFORE UPDATE ON users_address
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER users_payments_updated_at
BEFORE UPDATE ON users_payments
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER shipping_methods_updated_at
BEFORE UPDATE ON shipping_methods
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
