import type { RequestHandler } from "express";

import { problem } from "#/lib/problem";
import { parse } from "#/lib/token";

export const ADMIN = "admin";

declare module "express-serve-static-core" {
	// declaration merging, which a type alias cannot do
	// oxlint-disable-next-line typescript/consistent-type-definitions
	interface Request {
		// set by auth, which 401s before any handler runs
		idUser: number;
		roles?: string[];
	}
}

export const auth: RequestHandler = (req, res, next) => {
	const raw = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];

	if (raw === undefined) {
		problem(res, 401, "missing bearer token");
		return;
	}

	try {
		const claims = parse(raw);

		req.idUser = claims.idUser;
		req.roles = claims.roles;
	} catch {
		problem(res, 401, "invalid or expired token");
		return;
	}

	next();
};

export const admin: RequestHandler = (req, res, next) => {
	if (req.roles?.includes(ADMIN) !== true) {
		problem(res, 403, "admin only");
		return;
	}

	next();
};
