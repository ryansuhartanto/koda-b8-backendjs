import { expect, test } from "vite-plus/test";

import { contract } from "#/spec";

import go from "../apps/go/docs/swagger.json" with { type: "json" };
import js from "../apps/js/docs/swagger.json" with { type: "json" };

test("go and js describe the same API", () => {
	expect(contract(js)).toStrictEqual(contract(go));
});
