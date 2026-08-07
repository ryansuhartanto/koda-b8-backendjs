import { compare, hash } from "bcryptjs";
import { Router } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import { sign } from "#/lib/token";
import type {
	LoginRequest,
	RegisterRequest,
	TokenResponse,
} from "#/model/auth";

// distinguishing a missing account from a bad password is a user-enumeration oracle
const invalidCredentials = "invalid email or password";

function isEmail(value: unknown): value is string {
	return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toRegisterRequest(body: unknown): RegisterRequest | undefined {
	const { name, email, password } = (body ?? {}) as Record<string, unknown>;

	if (
		typeof name !== "string" ||
		name === "" ||
		!isEmail(email) ||
		typeof password !== "string" ||
		password.length < 8
	) {
		return undefined;
	}

	return { name, email, password };
}

function toLoginRequest(body: unknown): LoginRequest | undefined {
	const { email, password } = (body ?? {}) as Record<string, unknown>;

	if (!isEmail(email) || typeof password !== "string" || password === "") {
		return undefined;
	}

	return { email, password };
}

export const router: Router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         email: { type: string }
 *         password: { type: string, minLength: 8 }
 *       required: [email, name, password]
 *     LoginRequest:
 *       type: object
 *       properties:
 *         email: { type: string }
 *         password: { type: string }
 *       required: [email, password]
 *     TokenResponse:
 *       type: object
 *       properties:
 *         token: { type: string }
 *       required: [token]
 *
 * /auth/register:
 *   post:
 *     summary: Register an account
 *     tags: [auth]
 *     requestBody:
 *       description: Credentials
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RegisterRequest"
 *             summary: body
 *             description: Credentials
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/TokenResponse" }
 *       "400":
 *         description: Invalid body
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "409":
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.post("/auth/register", async (req, res) => {
	const body = toRegisterRequest(req.body);

	if (body === undefined) {
		problem(
			res,
			400,
			"name, email and a password of at least 8 characters are required",
		);
		return;
	}

	const client = await pool.connect();

	try {
		const passwordHash = await hash(body.password, 10);

		await client.query("BEGIN");

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

		// role is part of the primary key, so it has no column default to fall back on
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

		await client.query("COMMIT");

		const token: TokenResponse = { token: sign(user.id) };

		res.status(201).json(token);
	} catch (error) {
		await client.query("ROLLBACK");

		// unique_violation
		if ((error as { code?: string }).code === "23505") {
			problem(res, 409, "email already registered");
			return;
		}

		problem(res, 500, error);
	} finally {
		client.release();
	}
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Exchange credentials for a token
 *     tags: [auth]
 *     requestBody:
 *       description: Credentials
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LoginRequest"
 *             summary: body
 *             description: Credentials
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/TokenResponse" }
 *       "400":
 *         description: Invalid body
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "401":
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 *       "500":
 *         description: Internal error
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
router.post("/auth/login", async (req, res) => {
	const body = toLoginRequest(req.body);

	if (body === undefined) {
		problem(res, 400, "email and password are required");
		return;
	}

	try {
		const { rows } = await pool.query<{ id: number; password_hash: string }>(
			`SELECT
				id,
				password_hash
			FROM users
			WHERE email = $1 AND deleted_at IS NULL`,
			[body.email],
		);

		const [user] = rows;

		if (
			user === undefined ||
			!(await compare(body.password, user.password_hash))
		) {
			problem(res, 401, invalidCredentials);
			return;
		}

		const token: TokenResponse = { token: sign(user.id) };

		res.json(token);
	} catch (error) {
		problem(res, 500, error);
	}
});
