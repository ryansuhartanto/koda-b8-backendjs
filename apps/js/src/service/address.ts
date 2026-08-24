import { QueryTypes } from "@sequelize/core";

import { sequelize } from "#/lib/db";
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
	return sequelize.query<Address>(
		`SELECT ${columns}
		FROM users_address
		WHERE id_user = $1 AND deleted_at IS NULL
		ORDER BY is_default DESC, id`,
		{ type: QueryTypes.SELECT, bind: [idUser] },
	);
}

export async function create(
	idUser: number,
	body: AddressRequest,
): Promise<Address> {
	return sequelize.transaction(async (transaction) => {
		// the partial unique index allows only one default per user
		if (body.is_default) {
			await sequelize.query(
				"UPDATE users_address SET is_default = FALSE WHERE id_user = $1 AND deleted_at IS NULL",
				{ type: QueryTypes.UPDATE, bind: [idUser], transaction },
			);
		}

		const address = await sequelize.query<Address>(
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
			{
				type: QueryTypes.SELECT,
				plain: true,
				bind: [
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
				transaction,
			},
		);

		if (address === null) {
			throw new Error("insert returned no row");
		}

		return address;
	});
}
