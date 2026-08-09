import { expect, test } from "vite-plus/test";

import { capture, discover, fixture, go, js, reachable } from "#/client";
import type { Catalog } from "#/client";
import { scenarios } from "#/scenarios";

const blank: Catalog = {
	product: "",
	path: "/products/",
	variant: "",
	spare: "",
};

const live = await reachable();
const catalog = live ? await discover(go) : blank;
const shared = live ? await fixture(go, "shared", catalog) : undefined;

test
	.skipIf(!live)
	.each(
		scenarios(catalog).filter(
			(scenario) =>
				scenario.mutates !== true && scenario.nondeterministic !== true,
		),
	)("$name", async (scenario) => {
	const state = shared ?? {
		token: "",
		credentials: { email: "", password: "" },
		address: 0,
	};

	const [goCapture, jsCapture] = await Promise.all([
		capture(go, scenario, state),
		capture(js, scenario, state),
	]);

	expect(goCapture).toStrictEqual(jsCapture);
});
