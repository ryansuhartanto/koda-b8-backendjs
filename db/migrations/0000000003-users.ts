import type { UmzugContext } from "sqlumz";

const DROPPED = [
	"brands_summary",
	"categories_summary",
	"users_payments_active",
	"users_me",
];

export async function up({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	await queryInterface.sequelize.query(`
		CREATE VIEW users_me AS
		SELECT
			u.id,
			u.email,
			u.created_at,
			u.updated_at,
			p.name,
			p.phone,
			-- rendered here so no client timezone shifts a date-only value
			p.birthdate::TEXT AS birthdate,
			p.gender,
			p.avatar,
			COALESCE(ARRAY_AGG(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}')::TEXT[] AS roles
		FROM users u
		LEFT JOIN profile p ON p.id_user = u.id
		LEFT JOIN roles r ON r.id_user = u.id AND r.deleted_at IS NULL
		WHERE u.deleted_at IS NULL
		GROUP BY
			u.id, u.email, u.created_at, u.updated_at,
			p.name, p.phone, p.birthdate, p.gender, p.avatar
	`);

	await queryInterface.sequelize.query(`
		CREATE VIEW users_payments_active AS
		SELECT
			up.id,
			up.id_user,
			up.created_at,
			up.id_payment,
			pm.name AS type,
			up.is_default,
			up.data
		FROM users_payments up
		JOIN payment_methods pm ON pm.id = up.id_payment
		WHERE up.deleted_at IS NULL
	`);

	await queryInterface.sequelize.query(`
		CREATE VIEW categories_summary AS
		SELECT
			c.id,
			c.name,
			c.icon,
			c.img,
			COUNT(p.id) AS product_count
		FROM categories c
		LEFT JOIN products p ON p.id_category = c.id AND p.deleted_at IS NULL
		WHERE c.deleted_at IS NULL
		GROUP BY c.id
	`);

	await queryInterface.sequelize.query(`
		CREATE VIEW brands_summary AS
		SELECT
			b.id,
			b.name,
			COUNT(p.id) AS product_count
		FROM brands b
		LEFT JOIN products p ON p.id_brand = b.id AND p.deleted_at IS NULL
		WHERE b.deleted_at IS NULL
		GROUP BY b.id
	`);
}

export async function down({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	for (const view of DROPPED) {
		await queryInterface.sequelize.query(`DROP VIEW ${view}`);
	}
}
