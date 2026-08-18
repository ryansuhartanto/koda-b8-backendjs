import type { Router } from "express";

import { problem } from "#/lib/problem";
import { decode } from "#/lib/sqid";

declare module "express-serve-static-core" {
	// declaration merging, which a type alias cannot do
	// oxlint-disable-next-line typescript/consistent-type-definitions
	interface Request {
		ids: Record<string, number>;
	}
}

const NAMES = [
	"id_product",
	"id_variant",
	"id_order",
	"id_address",
	"id_payment",
];

/**
 * Decodes every sqid path parameter once, before any handler runs.
 *
 * Param callbacks are local to the router they are registered on and are NOT
 * inherited by routers mounted with `app.use`, so every route module has to call
 * this on its own router. Skipping it fails silently: the handler simply never
 * sees `req.ids`.
 */
export function intQuery(
	raw: unknown,
	key: string,
	fallback: number,
	min: number,
	max: number,
): number {
	if (raw === undefined || raw === "") {
		return fallback;
	}

	const value = Number(raw);

	if (
		typeof raw !== "string" ||
		!/^-?\d+$/.test(raw) ||
		value < min ||
		value > max
	) {
		throw new RangeError(`${key} must be an integer between ${min} and ${max}`);
	}

	return value;
}

export function sqids(router: Router): Router {
	for (const declared of NAMES) {
		router.param(declared, (req, res, next, raw: string, name: string) => {
			const id = decode(raw);

			if (id === undefined) {
				problem(res, 404, `no such ${name.slice("id_".length)}`);
				return;
			}

			req.ids = { ...req.ids, [name]: id };
			next();
		});
	}

	return router;
}
