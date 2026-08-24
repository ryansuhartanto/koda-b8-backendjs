import { expect, test } from "vite-plus/test";

import { serve } from "#/lib/serve";
import { encode } from "#/lib/sqid";
import { sign } from "#/lib/token";
import { router } from "#/routes/orders";
import { transitions } from "#/service/order";

process.env["JWT_SECRET"] ??= "orders-test-secret";

const customer = sign(1, ["customer"]);
const admin = sign(1, ["admin"]);

test("orders require a token", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/me/orders`);

		expect(res.status).toBe(401);
		expect(res.headers.get("content-type")).toContain(
			"application/problem+json",
		);
	});
});

test("the admin listing rejects a customer", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/orders`, {
			headers: { authorization: `Bearer ${customer}` },
		});

		expect(res.status).toBe(403);
		expect(res.headers.get("content-type")).toContain(
			"application/problem+json",
		);
	});
});

test("a status outside the enum is rejected before any query", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/orders/${encode(1)}`, {
			method: "PATCH",
			headers: {
				"authorization": `Bearer ${admin}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ status: "bogus" }),
		});

		expect(res.status).toBe(400);
	});
});

test("transitions only move forward and stop at the terminals", () => {
	const sequence = ["pending", "packed", "shipped", "delivered"];

	const backwards = Object.entries(transitions).flatMap(([from, targets]) =>
		targets
			.filter(
				(to) =>
					to !== "cancelled" && sequence.indexOf(to) <= sequence.indexOf(from),
			)
			.map((to) => `${from} -> ${to}`),
	);

	expect(backwards).toStrictEqual([]);
	expect(transitions.delivered).toStrictEqual([]);
	expect(transitions.cancelled).toStrictEqual([]);
});
