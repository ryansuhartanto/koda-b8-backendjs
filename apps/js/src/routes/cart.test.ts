import { expect, test } from "vite-plus/test";

import { serve } from "#/lib/serve";
import { router } from "#/routes/cart";

test("cart requires a token", async () => {
	await serve(router, async (url) => {
		const res = await fetch(`${url}/me/cart`);

		expect(res.status).toBe(401);
		expect(res.headers.get("content-type")).toContain(
			"application/problem+json",
		);
	});
});
