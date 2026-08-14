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
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_notify
AFTER INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE PROCEDURE notify_change();

CREATE TRIGGER orders_notify
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE PROCEDURE notify_change();
