import { expect, test } from "vite-plus/test";

import { serve } from "#/lib/serve";
import { sign } from "#/lib/token";
import { router } from "#/routes/products";

process.env["JWT_SECRET"] ??= "products-test-secret";

const customer = sign(1, ["customer"]);
const admin = sign(1, ["admin"]);

test("create rejects a customer", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/products`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${customer}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ name: "Test", original_price_idr: 1000 }),
		});

		expect(res.status).toBe(403);
		expect(res.headers.get("content-type")).toContain(
			"application/problem+json",
		);
	});
});

test("create rejects a body with no price before any query", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/products`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${admin}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ name: "Test" }),
		});

		expect(res.status).toBe(400);
	});
});

test("list rejects an unknown sort", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/products?sort=bogus`);

		expect(res.status).toBe(400);
		expect(res.headers.get("content-type")).toContain(
			"application/problem+json",
		);
	});
});

// the param hook is registered per router, so this fails if a new router skips sqids()
test("a malformed sqid is rejected by the param hook", async () => {
	const paths = ["/products/!!!!!!", "/products/a"];

	await serve(router, async (url) => {
		const got = await Promise.all(
			paths.map(async (path) => {
				const res = await fetch(`${url}${path}`, { redirect: "manual" });

				return {
					path,
					status: res.status,
					problem: res.headers
						.get("content-type")
						?.includes("application/problem+json"),
				};
			}),
		);

		expect(got).toStrictEqual(
			paths.map((path) => ({ path, status: 404, problem: true })),
		);
	});
});
