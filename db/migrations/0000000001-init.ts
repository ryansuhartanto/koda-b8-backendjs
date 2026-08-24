import type { UmzugContext } from "sqlumz";

const TIMESTAMPED = [
	"users",
	"roles",
	"categories",
	"brands",
	"products",
	"products_options",
	"products_options_values",
	"products_variants",
	"payment_methods",
	"ratings",
	"users_address",
	"users_payments",
	"shipping_methods",
	"orders",
];

const DROPPED = [
	"orders_items",
	"orders",
	"shipping_methods",
	"wishlist_items",
	"cart_items",
	"users_payments",
	"users_address",
	"payment_methods",
	"ratings",
	"products_price",
	"products_images",
	"products_variants_options",
	"products_variants",
	"products_options_values",
	"products_options",
	"products",
	"brands",
	"categories",
	"profile",
	"roles",
	"users",
];

export async function up({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	await queryInterface.sequelize.query(`
		CREATE TYPE user_role AS ENUM ('customer', 'admin')
	`);

	await queryInterface.sequelize.query(`
		CREATE TYPE order_status AS ENUM ('pending', 'packed', 'shipped', 'delivered', 'cancelled')
	`);

	await queryInterface.sequelize.query(`
		CREATE TYPE gender AS ENUM ('M', 'F', 'X')
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE users (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			email VARCHAR NOT NULL,
			password_hash VARCHAR NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX users_email_key
		ON users (email)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE roles (
			id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
			role user_role NOT NULL,
			PRIMARY KEY (id_user, role),

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE profile (
			id_user BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

			name VARCHAR NOT NULL,

			phone VARCHAR,
			birthdate DATE,
			gender gender,
			avatar VARCHAR
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE categories (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			name VARCHAR NOT NULL,
			icon VARCHAR,
			img VARCHAR
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX categories_name_key
		ON categories (name)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE brands (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			name VARCHAR NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX brands_name_key
		ON brands (name)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE products (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			id_category BIGINT REFERENCES categories (id),
			id_brand BIGINT REFERENCES brands (id),

			name VARCHAR NOT NULL,
			description VARCHAR
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_id_category_idx
		ON products (id_category)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_id_brand_idx
		ON products (id_brand)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE products_options (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,

			tier INT NOT NULL,
			name VARCHAR NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX products_options_tier_key
		ON products_options (id_product, tier)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX products_options_name_key
		ON products_options (id_product, name)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_options_id_product_idx
		ON products_options (id_product)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE products_options_values (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			id_option BIGINT NOT NULL REFERENCES products_options (id) ON DELETE CASCADE,

			name VARCHAR NOT NULL,
			description VARCHAR
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX products_options_values_name_key
		ON products_options_values (id_option, name)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_options_values_id_option_idx
		ON products_options_values (id_option)
	`);

	await queryInterface.sequelize.query(`
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
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX products_variants_sku_key
		ON products_variants (sku)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_variants_id_product_idx
		ON products_variants (id_product)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE products_variants_options (
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

			id_variant BIGINT NOT NULL REFERENCES products_variants (id) ON DELETE CASCADE,
			id_value BIGINT NOT NULL REFERENCES products_options_values (id) ON DELETE RESTRICT,

			PRIMARY KEY (id_variant, id_value)
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_variants_options_id_value_idx
		ON products_variants_options (id_value)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE products_images (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
			id_variant BIGINT,
			FOREIGN KEY (id_variant, id_product)
				REFERENCES products_variants (id, id_product) ON DELETE CASCADE,

			position INT NOT NULL,
			url VARCHAR NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX products_images_position_key
		ON products_images (id_product, position)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_images_id_product_idx
		ON products_images (id_product)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX products_images_id_variant_idx
		ON products_images (id_variant)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE products_price (
			id_variant BIGINT PRIMARY KEY REFERENCES products_variants (id) ON DELETE CASCADE,

			original_price_idr BIGINT NOT NULL,
			discount_price_idr BIGINT CHECK (discount_price_idr < original_price_idr),
			price_idr BIGINT NOT NULL GENERATED ALWAYS AS (COALESCE(discount_price_idr, original_price_idr)) STORED
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE ratings (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
			id_variant BIGINT NOT NULL REFERENCES products_variants (id) ON DELETE CASCADE,

			rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
			description VARCHAR
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE payment_methods (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

			name VARCHAR NOT NULL,
			is_available BOOLEAN NOT NULL DEFAULT TRUE,

			metadata JSON NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX payment_methods_name_key
		ON payment_methods (name)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX ratings_id_user_id_variant_key
		ON ratings (id_user, id_variant)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX ratings_id_variant_idx
		ON ratings (id_variant)
	`);

	await queryInterface.sequelize.query(`
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
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX users_address_default_key
		ON users_address (id_user)
		WHERE deleted_at IS NULL AND is_default
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX users_address_id_user_idx
		ON users_address (id_user)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE users_payments (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			id_payment BIGINT NOT NULL REFERENCES payment_methods (id) ON DELETE CASCADE,
			id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

			is_default BOOLEAN NOT NULL DEFAULT FALSE,

			data JSON NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX users_payments_default_key
		ON users_payments (id_user)
		WHERE is_default AND deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX users_payments_id_payment_idx
		ON users_payments (id_payment)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX users_payments_id_user_idx
		ON users_payments (id_user)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE cart_items (
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

			id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
			id_variant BIGINT NOT NULL REFERENCES products_variants (id) ON DELETE CASCADE,
			PRIMARY KEY (id_user, id_variant),

			quantity INT NOT NULL CHECK (quantity > 0)
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX cart_items_id_variant_idx
		ON cart_items (id_variant)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE wishlist_items (
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

			id_user BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
			id_product BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
			PRIMARY KEY (id_user, id_product)
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX wishlist_items_id_product_idx
		ON wishlist_items (id_product)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE shipping_methods (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ,

			name VARCHAR NOT NULL,
			cost_idr BIGINT NOT NULL
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE UNIQUE INDEX shipping_methods_name_key
		ON shipping_methods (name)
		WHERE deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
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
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX orders_id_user_idx
		ON orders (id_user)
	`);

	await queryInterface.sequelize.query(`
		CREATE TABLE orders_items (
			id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

			id_order BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
			id_variant BIGINT REFERENCES products_variants (id) ON DELETE SET NULL,

			product_name VARCHAR NOT NULL,
			variant_name VARCHAR,
			unit_price_idr BIGINT NOT NULL,
			quantity INT NOT NULL CHECK (quantity > 0)
		)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX orders_items_id_order_idx
		ON orders_items (id_order)
	`);

	await queryInterface.sequelize.query(`
		CREATE INDEX orders_items_id_variant_idx
		ON orders_items (id_variant)
	`);

	await queryInterface.sequelize.query(`
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
		$$ language plpgsql
	`);

	for (const table of TIMESTAMPED) {
		await queryInterface.sequelize.query(`
			CREATE TRIGGER ${table}_updated_at
			BEFORE UPDATE ON ${table}
			FOR EACH ROW EXECUTE PROCEDURE update_updated_at()
		`);
	}
}

export async function down({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	for (const table of DROPPED) {
		await queryInterface.sequelize.query(`DROP TABLE ${table}`);
	}

	await queryInterface.sequelize.query(`
		DROP TYPE gender
	`);

	await queryInterface.sequelize.query(`
		DROP TYPE order_status
	`);

	await queryInterface.sequelize.query(`
		DROP TYPE user_role
	`);

	await queryInterface.sequelize.query(`
		DROP FUNCTION update_updated_at()
	`);
}
