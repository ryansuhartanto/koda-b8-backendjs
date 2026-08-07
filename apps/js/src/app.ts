import { apiReference } from "@scalar/express-api-reference";
import express from "express";
import type { Express } from "express";

import { pool } from "#/lib/db";
import { problem } from "#/lib/problem";
import { cors } from "#/middleware/cors";
import { router as addresses } from "#/routes/addresses";
import { router as auth } from "#/routes/auth";
import { router as cart } from "#/routes/cart";
import { router as orders } from "#/routes/orders";
import { router as products } from "#/routes/products";
import { router as shipping } from "#/routes/shipping";

import spec from "../docs/swagger.json" with { type: "json" };

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors);

app.get("/", (_req, res) => {
	res.redirect(301, "/docs");
});

app.use(
	"/docs",
	apiReference({
		content: spec,
		tagsSorter: "alpha",
	}),
);

app.use(auth);
app.use(products);
app.use(shipping);
app.use(cart);
app.use(addresses);
app.use(orders);

/**
 * @openapi
 * /healthz:
 *   get:
 *     summary: Liveness and database reachability
 *     tags: [meta]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: { type: string }
 *       "503":
 *         description: Database unreachable
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Problem" }
 */
app.get("/healthz", async (_req, res) => {
	try {
		await pool.query("SELECT 1");
		res.json({ status: "ok" });
	} catch (error) {
		problem(res, 503, error);
	}
});

// both frameworks answer an unknown path in their own format, not RFC 9457
app.use((_req, res) => {
	problem(res, 404, "no such endpoint");
});

export default app;
