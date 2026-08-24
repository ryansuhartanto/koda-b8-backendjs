import { Router } from "express";

import { sqids } from "#/lib/params";
import { fail, problem } from "#/lib/problem";
import { wire } from "#/lib/wire";
import { auth } from "#/middleware/auth";
import type { AddressRequest } from "#/model/address";
import * as addresses from "#/service/address";

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
 *     summary: List addresses
 *     tags: [addresses]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: "#/components/schemas/Address" } }
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
router.get("/me/addresses", auth, async (req, res) => {
	try {
		res.json(wire(await addresses.list(req.idUser)));
	} catch (error) {
		fail(res, error);
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

	try {
		res.status(201).json(wire(await addresses.create(req.idUser, body)));
	} catch (error) {
		fail(res, error);
	}
});
