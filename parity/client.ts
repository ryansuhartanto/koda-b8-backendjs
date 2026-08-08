import type { Scenario } from "#/scenarios";

export const go = process.env["GO_URL"] ?? "http://localhost:3001";
export const js = process.env["JS_URL"] ?? "http://localhost:3002";

export type Fixture = {
	token: string;
	credentials: { email: string; password: string };
	address: number;
};

export type Catalog = {
	product: string;
	path: string;
	variant: string;
	spare: string;
};

export type Capture = {
	status: number;
	headers: Record<string, string>;
	body: string;
};

// x-powered-by names the framework, so the two are meant to differ
const ignored = new Set([
	"date",
	"content-length",
	"keep-alive",
	"connection",
	"x-powered-by",
]);

export async function capture(
	base: string,
	scenario: Scenario,
	fixture: Fixture,
): Promise<Capture> {
	const headers: Record<string, string> = {};
	const token = scenario.token ?? (scenario.auth === true ? fixture.token : "");

	const fromFixture = {
		credentials: fixture.credentials,
		order: {
			id_address: fixture.address,
			payment_method: "transfer",
			ship_method: "JNE Reguler",
		},
	};

	const body =
		scenario.bodyFromFixture === undefined
			? scenario.body
			: fromFixture[scenario.bodyFromFixture];

	if (token !== "") {
		headers["authorization"] = `Bearer ${token}`;
	}

	if (body !== undefined) {
		headers["content-type"] = "application/json";
	}

	const res = await fetch(`${base}${scenario.path}`, {
		method: scenario.method ?? "GET",
		headers,
		body: body === undefined ? null : JSON.stringify(body),
		redirect: "manual",
	});

	return {
		status: res.status,
		headers: Object.fromEntries(
			[...res.headers].filter(([name]) => !ignored.has(name)),
		),
		body: await res.text(),
	};
}

async function get<T>(base: string, path: string): Promise<T> {
	const res = await fetch(`${base}${path}`);

	if (!res.ok) {
		throw new Error(
			`${base}${path} answered ${res.status}: ${await res.text()}`,
		);
	}

	return (await res.json()) as T;
}

type Stocked = { id: string; inventory: number };

export async function discover(base: string): Promise<Catalog> {
	const listing = await get<Array<Stocked & { path: string }>>(
		base,
		"/products?limit=100",
	);

	const ranked = listing.toSorted((a, b) => b.inventory - a.inventory);
	const [deepest] = ranked;

	if (deepest === undefined) {
		throw new Error(`${base} has no products; is the database seeded?`);
	}

	const details = await Promise.all(
		ranked.map(async (product) =>
			get<{ variants?: Stocked[] }>(base, product.path),
		),
	);

	const stocked = details
		.flatMap((detail) => detail.variants ?? [])
		.toSorted((a, b) => b.inventory - a.inventory);

	const [variant, spare] = stocked;

	if (variant === undefined || spare === undefined) {
		throw new Error(`${base} has fewer than two variants in stock`);
	}

	return {
		product: deepest.id,
		path: deepest.path,
		variant: variant.id,
		spare: spare.id,
	};
}

async function must(base: string, path: string, body: unknown, token?: string) {
	const res = await fetch(`${base}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		throw new Error(
			`${base}${path} answered ${res.status}: ${await res.text()}`,
		);
	}

	return res.status === 204
		? {}
		: ((await res.json()) as Record<string, never>);
}

export async function fixture(
	base: string,
	tag: string,
	catalog: Catalog,
): Promise<Fixture> {
	const credentials = {
		email: `parity-${tag}-${Date.now()}@invalid.test`,
		password: "parity-password",
	};

	const { token } = (await must(base, "/auth/register", {
		name: "Parity",
		...credentials,
	})) as unknown as { token: string };

	const { id } = (await must(
		base,
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

	await must(
		base,
		"/cart",
		{ id_variant: catalog.variant, quantity: 1 },
		token,
	);
	await must(
		base,
		"/orders",
		{ id_address: id, payment_method: "transfer", ship_method: "JNE Reguler" },
		token,
	);
	// left behind so GET /cart has rows to validate
	await must(base, "/cart", { id_variant: catalog.spare, quantity: 1 }, token);

	const empty = await Promise.all(
		["/cart", "/addresses", "/orders"].map(async (path) => {
			const res = await fetch(`${base}${path}`, {
				headers: { authorization: `Bearer ${token}` },
			});

			return ((await res.json()) as unknown[]).length === 0 ? path : "";
		}),
	);

	const blank = empty.filter((path) => path !== "");

	if (blank.length > 0) {
		throw new Error(`fixture left ${blank.join(", ")} empty`);
	}

	return { token, credentials, address: id };
}

async function up(): Promise<boolean> {
	try {
		const probes = await Promise.all(
			[go, js].map(async (base) => fetch(`${base}/healthz`)),
		);

		return probes.every((res) => res.ok);
	} catch {
		return false;
	}
}

export async function reachable(): Promise<boolean> {
	const running = await up();

	if (!running && process.env["TEST_PARITY_OPTIONAL"] !== "1") {
		throw new Error(
			`parity needs ${go} and ${js} running; set TEST_PARITY_OPTIONAL=1 to skip instead`,
		);
	}

	return running;
}
