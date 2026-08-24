import type { UmzugContext } from "sqlumz";

const NOTIFIED = ["products", "orders"];

export async function up({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	await queryInterface.sequelize.query(`
		CREATE FUNCTION notify_change()
		RETURNS TRIGGER AS $$
		BEGIN
			IF TG_OP = 'UPDATE' AND row(NEW.*) IS NOT DISTINCT FROM row(OLD.*) THEN
				RETURN NULL;
			END IF;

			PERFORM pg_notify('changes', JSON_BUILD_OBJECT(
				'table', TG_TABLE_NAME,
				'op', CASE
					WHEN TG_OP = 'INSERT' THEN 'created'
					WHEN NEW.deleted_at IS NOT NULL THEN 'deleted'
					ELSE 'updated'
				END,
				'id', NEW.id,
				'id_user', TO_JSONB(NEW) -> 'id_user'
			)::TEXT);

			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql
	`);

	for (const table of NOTIFIED) {
		await queryInterface.sequelize.query(`
			CREATE TRIGGER ${table}_notify
			AFTER INSERT OR UPDATE ON ${table}
			FOR EACH ROW EXECUTE PROCEDURE notify_change()
		`);
	}
}

export async function down({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	for (const table of NOTIFIED.toReversed()) {
		await queryInterface.sequelize.query(
			`DROP TRIGGER ${table}_notify ON ${table}`,
		);
	}

	await queryInterface.sequelize.query(`
		DROP FUNCTION notify_change()
	`);
}
