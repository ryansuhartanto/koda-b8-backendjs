import { Router } from "express";

import { fail, problem } from "#/lib/problem";
import type { LoginRequest, RegisterRequest } from "#/model/auth";
import * as accounts from "#/service/auth";

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
 *     summary: Register
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

	try {
		res.status(201).json(await accounts.register(body));
	} catch (error) {
		fail(res, error);
	}
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate
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
		res.json(await accounts.login(body));
	} catch (error) {
		fail(res, error);
	}
});
