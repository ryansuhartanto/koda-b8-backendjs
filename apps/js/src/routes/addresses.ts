import { Router } from "express";

import { pool } from "#/lib/db";
import { sqids } from "#/lib/params";
import { problem } from "#/lib/problem";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
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

const required = [
	"label",
	"name",
	"phone",
	"address",
	"city",
	"province",
	"postal_code",
] as const;

function toAddressRequest(body: unknown): AddressRequest | undefined {
	const raw = (body ?? {}) as Record<string, unknown>;

	if (required.some((key) => typeof raw[key] !== "string" || raw[key] === "")) {
		return undefined;
	}

	const isDefault = raw["is_default"] ?? false;

	if (typeof isDefault !== "boolean") {
		return undefined;
	}

	return {
		label: raw["label"] as string,
		name: raw["name"] as string,
		phone: raw["phone"] as string,
		address: raw["address"] as string,
		city: raw["city"] as string,
		province: raw["province"] as string,
		postal_code: raw["postal_code"] as string,
		is_default: isDefault,
	};
}

export const router: Router = sqids(Router());

/**
 * @openapi
 * components:
 *   schemas:
 *     Address:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         label: { type: string }
 *         name: { type: string }
 *         phone: { type: string }
 *         address: { type: string }
 *         city: { type: string }
 *         province: { type: string }
 *         postal_code: { type: string }
 *         is_default: { type: boolean }
 *       required:
 *         [address, city, id, is_default, label, name, phone, postal_code, province]
 *     AddressRequest:
 *       type: object
 *       properties:
 *         label: { type: string }
 *         name: { type: string }
 *         phone: { type: string }
 *         address: { type: string }
 *         city: { type: string }
 *         province: { type: string }
 *         postal_code: { type: string }
 *         is_default: { type: boolean }
 *       required: [address, city, label, name, phone, postal_code, province]
 *
 * /me/addresses:
 *   get:
 *     summary: List the caller's addresses, default first
 *     tags: [addresses]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Address" } }
 *       "401":
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *   post:
 *     summary: Add an address
 *     tags: [addresses]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       description: Address
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AddressRequest"
 *             summary: body
 *             description: Address
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Address" }
 *       "400":
 *         description: Invalid body
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "401":
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/me/addresses", auth, async (req, res) => {
	try {
		const { rows } = await pool.query<Address>(
			`SELECT ${columns}
			FROM users_address
			WHERE id_user = $1 AND deleted_at IS NULL
			ORDER BY is_default DESC, id`,
			[req.idUser],
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});

router.post("/me/addresses", auth, async (req, res) => {
	const body = toAddressRequest(req.body);

	if (body === undefined) {
		problem(
			res,
			400,
			"label, name, phone, address, city, province and postal_code are required",
		);
		return;
	}

	const client = await pool.connect();

	try {
		await client.query("BEGIN");

		// the partial unique index allows only one default per user
		if (body.is_default) {
			await client.query(
				"UPDATE users_address SET is_default = FALSE WHERE id_user = $1 AND deleted_at IS NULL",
				[req.idUser],
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
				req.idUser,
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

		await client.query("COMMIT");

		const [address] = rows;

		if (address === undefined) {
			throw new Error("insert returned no row");
		}

		res.status(201).json(wire(address));
	} catch (error) {
		await client.query("ROLLBACK");
		problem(res, 500, error);
	} finally {
		client.release();
	}
});
