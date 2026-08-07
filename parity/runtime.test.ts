import { expect, test } from "vite-plus/test";

import { errors, reads } from "#/scenarios";
import type { Scenario } from "#/scenarios";

const go = process.env["GO_URL"] ?? "http://localhost:3001";
const js = process.env["JS_URL"] ?? "http://localhost:3002";

// only headers the API sets deliberately; Date and Content-Length would always differ
const compared = ["content-type", "link", "x-total-count", "location"];

type Capture = {
	status: number;
	headers: Record<string, string>;
	body: string;
};

async function capture(
	base: string,
	scenario: Scenario,
	token: string,
): Promise<Capture> {
	const headers: Record<string, string> = {};

	if (scenario.auth === true) {
		headers["authorization"] = `Bearer ${token}`;
	}

	if (scenario.body !== undefined) {
		headers["content-type"] = "application/json";
	}

	const res = await fetch(`${base}${scenario.path}`, {
		method: scenario.method ?? "GET",
		headers,
		body: scenario.body === undefined ? null : JSON.stringify(scenario.body),
		redirect: "manual",
	});

	return {
		status: res.status,
		headers: Object.fromEntries(
			compared
				.filter((name) => res.headers.has(name))
				.map((name) => [name, res.headers.get(name) ?? ""]),
		),
		body: await res.text(),
	};
}

async function post(base: string, path: string, body: unknown, token?: string) {
	const res = await fetch(`${base}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
		},
		body: JSON.stringify(body),
	});

	return res.status === 204
		? {}
		: ((await res.json()) as Record<string, never>);
}

// One user, shared by both services, so the read scenarios see the same rows and
// no generated id or timestamp has to be masked out of the comparison.
async function fixture(): Promise<string> {
	const email = `parity-${Date.now()}@invalid.test`;
	const { token } = (await post(go, "/auth/register", {
		name: "Parity",
		email,
		password: "parity-password",
	})) as unknown as { token: string };

	const { id } = (await post(
		go,
		"/addresses",
		{
			label: "Rumah",
			name: "Parity",
			phone: "0800000000",
			address: "Jl Parity 1",
			city: "Jakarta",
			province: "DKI Jakarta",
			postal_code: "10110",
			is_default: true,
		},
		token,
	)) as unknown as { id: number };

	await post(go, "/cart", { id_variant: "0Jtbd2", quantity: 2 }, token);
	await post(go, "/cart", { id_variant: "STwWh7", quantity: 1 }, token);
	await post(
		go,
		"/orders",
		{ id_address: id, payment_method: "transfer", ship_method: "JNE Reguler" },
		token,
	);
	// left in the cart on purpose, so GET /cart has something to compare
	await post(go, "/cart", { id_variant: "0Jtbd2", quantity: 3 }, token);

	return token;
}

async function reachable(): Promise<boolean> {
	try {
		const probes = await Promise.all(
			[go, js].map(async (base) => fetch(`${base}/shipping-methods`)),
		);

		return probes.every((res) => res.ok);
	} catch {
		return false;
	}
}

// skipped rather than failed when the services are down, so `mise run test` stays hermetic
const live = await reachable();
const token = live ? await fixture() : "";

test.skipIf(!live).each([...reads, ...errors])("$name", async (scenario) => {
	const [a, b] = await Promise.all([
		capture(go, scenario, token),
		capture(js, scenario, token),
	]);

	expect(b).toStrictEqual(a);
});
