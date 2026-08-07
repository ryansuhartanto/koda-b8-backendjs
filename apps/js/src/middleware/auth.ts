import type { RequestHandler } from "express";

import { problem } from "#/lib/problem";
import { parse } from "#/lib/token";

declare module "express-serve-static-core" {
	// declaration merging, which a type alias cannot do
	// oxlint-disable-next-line typescript/consistent-type-definitions
	interface Request {
		idUser?: number;
	}
}

export const auth: RequestHandler = (req, res, next) => {
	const raw = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];

	if (raw === undefined) {
		problem(res, 401, "missing bearer token");
		return;
	}

	try {
		req.idUser = parse(raw);
	} catch {
		problem(res, 401, "invalid or expired token");
		return;
	}

	next();
};
