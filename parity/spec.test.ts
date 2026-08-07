import { expect, test } from "vite-plus/test";

import go from "../apps/go/docs/swagger.json" with { type: "json" };
import js from "../apps/js/docs/swagger.json" with { type: "json" };

// swag stubs an empty externalDocs that no annotation suppresses
function contract(spec: Record<string, unknown>): unknown {
	const { servers: _servers, externalDocs: _externalDocs, ...rest } = spec;

	return sortDeep(rest);
}

function sortDeep(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value
			.map(sortDeep)
			.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	}

	if (value === null || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value)
			.toSorted(([a], [b]) => a.localeCompare(b))
			.map(([key, inner]) => [key, sortDeep(inner)]),
	);
}

test("go and js describe the same API", () => {
	expect(contract(js)).toStrictEqual(contract(go));
});
