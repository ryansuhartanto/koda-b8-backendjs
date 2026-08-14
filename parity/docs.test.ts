import { readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

import { go, js, reachable } from "#/client";
import { contract } from "#/spec";

const live = await reachable();

const services = [
	{ name: "go", base: go, file: "apps/go/docs/swagger.json" },
	{ name: "js", base: js, file: "apps/js/docs/swagger.json" },
];

async function served(base: string) {
	const res = await fetch(`${base}/docs/openapi.json`);

	return {
		status: res.status,
		type: res.headers.get("content-type"),
		body: await res.text(),
	};
}

test.skipIf(!live).each(services)(
	"$name serves the spec it was built from",
	async ({ base, file }) => {
		const res = await served(base);

		expect(res.status).toBe(200);
		expect(res.type).toContain("application/json");
		expect(JSON.parse(res.body)).toStrictEqual(
			JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")),
		);
	},
);

test.skipIf(!live)("both services serve the same spec", async () => {
	const [goRes, jsRes] = await Promise.all([served(go), served(js)]);

	expect(goRes.type).toBe(jsRes.type);
	expect(contract(JSON.parse(jsRes.body))).toStrictEqual(
		contract(JSON.parse(goRes.body)),
	);
});

test.skipIf(!live).each(services)(
	"$name docs page points at the spec endpoint",
	async ({ base }) => {
		const res = await fetch(`${base}/docs`);

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");

		const page = await res.text();

		// go's html/template escapes the slashes inside the script block
		expect(page.replaceAll(String.raw`\/`, "/")).toContain(
			"/docs/openapi.json",
		);
	},
);
