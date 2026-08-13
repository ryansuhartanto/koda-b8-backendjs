import { Router } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
import type { UsersMe, UsersPaymentsActive } from "#/model/user";

export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         email: { type: string }
 *         created_at: { type: string }
 *         updated_at: { type: string }
 *         name: { type: string }
 *         phone: { type: string }
 *         birthdate: { type: string }
 *         gender: { type: string }
 *         avatar: { type: string }
 *         roles:
 *           type: array
 *           items: { type: string }
 *           uniqueItems: false
 *       required: [created_at, email, id, roles, updated_at]
 *     UserPayment:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         created_at: { type: string }
 *         id_payment: { type: string }
 *         type: { type: string }
 *         is_default: { type: boolean }
 *         data: { type: object }
 *       required: [created_at, data, id, id_payment, is_default, type]
 *
 * /me:
 *   get:
 *     summary: The caller's own profile
 *     tags: [me]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/User" }
 *       "401":
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "404":
 *         description: No such user
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.get("/me", auth, async (req, res) => {
	try {
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
			[req.idUser],
		);

		const [row] = rows;

		// the token outlived the account
		if (row === undefined) {
			problem(res, 404, "no such user");
			return;
		}

		res.json(wire(row));
	} catch (error) {
		problem(res, 500, error);
	}
});

/**
 * @openapi
 * /me/payments:
 *   get:
 *     summary: The caller's saved payment methods
 *     tags: [me]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               { type: array, items: { $ref: "#/components/schemas/UserPayment" } }
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
router.get("/me/payments", auth, async (req, res) => {
	try {
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
			[req.idUser],
		);

		res.json(wire(rows));
	} catch (error) {
		problem(res, 500, error);
	}
});
