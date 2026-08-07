import { expect, test } from "vite-plus/test";

import { capture, fixture, go, js, reachable } from "#/client";
import { scenarios } from "#/scenarios";

const live = await reachable();
const shared = live ? await fixture(go, "shared") : undefined;

test
	.skipIf(!live)
	.each(scenarios.filter((scenario) => scenario.mutates !== true))(
	"$name",
	async (scenario) => {
		const state = shared ?? {
			token: "",
			credentials: { email: "", password: "" },
			address: 0,
		};

		const [a, b] = await Promise.all([
			capture(go, scenario, state),
			capture(js, scenario, state),
		]);

		expect(b).toStrictEqual(a);
	},
);
