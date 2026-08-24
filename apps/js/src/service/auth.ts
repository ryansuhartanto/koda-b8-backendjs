import { compare, hash } from "bcryptjs";

import { pool, transact } from "#/lib/db";
import { HttpError } from "#/lib/problem";
import { sign } from "#/lib/token";
import type { AuthResponse, LoginRequest, RegisterRequest } from "#/model/auth";

// a distinct "no such account" is a user-enumeration oracle
const invalidCredentials = "invalid email or password";

export async function register(body: RegisterRequest): Promise<AuthResponse> {
	// hashing outside the transaction so it does not hold a connection open
	const passwordHash = await hash(body.password, 10);

	try {
		const id = await transact(async (client) => {
			const { rows } = await client.query<{ id: number }>(
				`INSERT INTO users (
					email,
					password_hash
				)
				VALUES (
					$1,
					$2
				)
				RETURNING id`,
				[body.email, passwordHash],
			);

			const [user] = rows;

			if (user === undefined) {
				throw new Error("insert returned no row");
			}

			await client.query(
				`INSERT INTO profile (
					id_user,
					name
				)
				VALUES (
					$1,
					$2
				)`,
				[user.id, body.name],
			);

			// role is part of the primary key, so it has no column default
			await client.query(
				`INSERT INTO roles (
					id_user,
					role
				)
				VALUES (
					$1,
					'customer'
				)`,
				[user.id],
			);

			return user.id;
		});

		// the transaction above granted exactly this role
		return { token: sign(id, ["customer"]) };
	} catch (error) {
		// unique_violation
		if ((error as { code?: string }).code === "23505") {
			throw new HttpError(409, "email already registered");
		}

		throw error;
	}
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
	const { rows } = await pool.query<{
		id: number;
		password_hash: string;
		roles: string[];
	}>(
		`SELECT
			u.id,
			u.password_hash,
			COALESCE(ARRAY_AGG(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}')::TEXT[] AS roles
		FROM users u
		LEFT JOIN roles r ON r.id_user = u.id AND r.deleted_at IS NULL
		WHERE u.email = $1 AND u.deleted_at IS NULL
		GROUP BY u.id, u.password_hash`,
		[body.email],
	);

	const [user] = rows;

	if (
		user === undefined ||
		!(await compare(body.password, user.password_hash))
	) {
		throw new HttpError(401, invalidCredentials);
	}

	return { token: sign(user.id, user.roles) };
}
