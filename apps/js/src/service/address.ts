import { pool, transact } from "#/lib/db";
import type { Address, AddressRequest } from "#/model/address";

const columns = `
	id,
	label,
	name,
	phone,
	address,
	city,
	province,
	postal_code,
	is_default`;

export async function list(idUser: number): Promise<Address[]> {
	const { rows } = await pool.query<Address>(
		`SELECT ${columns}
		FROM users_address
		WHERE id_user = $1 AND deleted_at IS NULL
		ORDER BY is_default DESC, id`,
		[idUser],
	);

	return rows;
}

export async function create(
	idUser: number,
	body: AddressRequest,
): Promise<Address> {
	return transact(async (client) => {
		// the partial unique index allows only one default per user
		if (body.is_default) {
			await client.query(
				"UPDATE users_address SET is_default = FALSE WHERE id_user = $1 AND deleted_at IS NULL",
				[idUser],
			);
		}

		const { rows } = await client.query<Address>(
			`INSERT INTO users_address (
				id_user,
				label,
				name,
				phone,
				address,
				city,
				province,
				postal_code,
				is_default
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9
			)
			RETURNING ${columns}`,
			[
				idUser,
				body.label,
				body.name,
				body.phone,
				body.address,
				body.city,
				body.province,
				body.postal_code,
				body.is_default,
			],
		);

		const [address] = rows;

		if (address === undefined) {
			throw new Error("insert returned no row");
		}

		return address;
	});
}
