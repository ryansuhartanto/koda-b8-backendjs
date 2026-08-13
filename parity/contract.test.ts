import { expect, test } from "vite-plus/test";

import { capture, discover, fixture, go, js, reachable } from "#/client";
import type { Catalog, Fixture } from "#/client";
import { scenarios } from "#/scenarios";
import type { Scenario } from "#/scenarios";

import goSpec from "../apps/go/docs/swagger.json" with { type: "json" };
import jsSpec from "../apps/js/docs/swagger.json" with { type: "json" };

type Property = {
	type?: string;
	items?: { $ref?: string };
	$ref?: string;
};

type Schema = {
	required?: string[];
	properties?: Record<string, Property>;
	additionalProperties?: unknown;
};

type Schemas = Record<string, Schema>;

const specs: Record<string, Schemas> = {
	go: (goSpec as { components: { schemas: Schemas } }).components.schemas,
	js: (jsSpec as { components: { schemas: Schemas } }).components.schemas,
};

const primitive: Record<string, string> = {
	number: "number",
	integer: "number",
	string: "string",
	boolean: "boolean",
};

function named(ref: string | undefined): string | undefined {
	return ref?.split("/").pop();
}

function parse(text: string, found: string[]): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		found.push(`body is not JSON: ${JSON.stringify(text)}`);

		return undefined;
	}
}

function check(
	schemas: Schemas,
	name: string,
	row: unknown,
	at: string,
	found: string[],
): void {
	const schema = schemas[name];

	if (schema === undefined) {
		found.push(`${at}: no schema named ${name}`);
		return;
	}

	if (row === null || typeof row !== "object" || Array.isArray(row)) {
		found.push(`${at}: expected an object, got ${JSON.stringify(row)}`);
		return;
	}

	for (const key of schema.required ?? []) {
		if (!(key in row)) {
			found.push(`${at}: missing ${key}`);
		}
	}

	for (const [key, value] of Object.entries(row)) {
		const declared = schema.properties?.[key];

		if (declared === undefined) {
			if (schema.additionalProperties === undefined) {
				found.push(`${at}: undeclared ${key}`);
			}
			continue;
		}

		const nested = named(declared.$ref);

		if (nested !== undefined) {
			check(schemas, nested, value, `${at}.${key}`, found);
			continue;
		}

		if (declared.type === "array") {
			if (!Array.isArray(value)) {
				found.push(`${at}.${key}: expected an array`);
				continue;
			}

			const element = named(declared.items?.$ref);

			if (element !== undefined) {
				for (const [index, entry] of value.entries()) {
					check(schemas, element, entry, `${at}.${key}[${index}]`, found);
				}
			}
			continue;
		}

		const want = primitive[declared.type ?? ""];

		if (want !== undefined && typeof value !== want) {
			found.push(
				`${at}.${key}: ${value === null ? "null" : typeof value}, spec says ${declared.type}`,
			);
		}
	}
}

function violations(
	schemas: Schemas,
	scenario: Scenario,
	status: number,
	body: string,
): string[] {
	const found: string[] = [];

	if (status !== scenario.status) {
		found.push(`status ${status}, spec says ${scenario.status}`);
	}

	if (scenario.schema === undefined) {
		return found;
	}

	const parsed = parse(body, found);

	if (parsed === undefined) {
		return found;
	}

	if (scenario.array !== true) {
		check(schemas, scenario.schema, parsed, "", found);

		return found;
	}

	if (!Array.isArray(parsed)) {
		found.push("expected an array");
	} else if (parsed.length === 0) {
		found.push("empty, so nothing was validated");
	} else {
		for (const [index, row] of parsed.entries()) {
			check(schemas, scenario.schema, row, `[${index}]`, found);
		}
	}

	return found;
}

const live = await reachable();
const blank: Fixture = {
	token: "",
	credentials: { email: "", password: "" },
	address: "",
	payment: "",
};

const catalog: Catalog = live
	? await discover(go)
	: { product: "", variant: "", spare: "", payment: "" };

const state: Record<string, Fixture> = live
	? {
			go: await fixture(go, "go", catalog),
			js: await fixture(js, "js", catalog),
		}
	: { go: blank, js: blank };

const cases = [
	{ base: go, service: "go" },
	{ base: js, service: "js" },
].flatMap(({ base, service }) =>
	scenarios(catalog).map((scenario) => ({ base, service, scenario })),
);

test.skipIf(!live).each(cases)(
	"$service $scenario.name",
	async ({ base, service, scenario }) => {
		const res = await capture(base, scenario, state[service] ?? blank);
		const schemas = specs[service] ?? {};

		expect(violations(schemas, scenario, res.status, res.body)).toStrictEqual(
			[],
		);
	},
);
