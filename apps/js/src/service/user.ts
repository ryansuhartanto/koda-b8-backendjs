import { pool } from "#/lib/db";
import { HttpError } from "#/lib/problem";
import type { UsersMe, UsersPaymentsActive } from "#/model/user";

export async function me(idUser: number): Promise<UsersMe> {
	const { rows } = await pool.query<UsersMe>(
		`SELECT
			id,
			email,
			created_at,
			updated_at,
			name,
			phone,
			birthdate,
			gender,
			avatar,
			roles
		FROM users_me
		WHERE id = $1`,
		[idUser],
	);

	const [row] = rows;

	// the token outlived the account
	if (row === undefined) {
		throw new HttpError(404, "no such user");
	}

	return row;
}

export async function payments(idUser: number): Promise<UsersPaymentsActive[]> {
	const { rows } = await pool.query<UsersPaymentsActive>(
		`SELECT
			id,
			created_at,
			id_payment,
			type,
			is_default,
			data
		FROM users_payments_active
		WHERE id_user = $1
		ORDER BY is_default DESC, id`,
		[idUser],
	);

	return rows;
}
