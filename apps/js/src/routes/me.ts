import { Router } from "express";

import { fail } from "#/lib/problem";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
import * as users from "#/service/user";

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
 *     summary: Fetch the profile
 *     tags: [me]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/User" }
 *       "401":
 *         description: Invalid token
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
		res.json(wire(await users.me(req.idUser)));
	} catch (error) {
		fail(res, error);
	}
});

/**
 * @openapi
 * /me/payments:
 *   get:
 *     summary: List saved payment methods
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
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
// TODO: add POST /me/payments; a fresh fixture has none to validate
router.get("/me/payments", auth, async (req, res) => {
	try {
		res.json(wire(await users.payments(req.idUser)));
	} catch (error) {
		fail(res, error);
	}
});
