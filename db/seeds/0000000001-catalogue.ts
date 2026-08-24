import { fakerID_ID as faker } from "@faker-js/faker";
import { hashSync } from "bcryptjs";
import type { UmzugContext } from "sqlumz";

import catalogue from "../catalogue.json" with { type: "json" };

// oxlint-disable no-console

const FAKER_SEED = 676767;
const DEMO_EMAIL = "demo@belimudah.test";
const DEMO_PASSWORD = "demo1234";
const RATER_DOMAIN = "@belimudah.test";
const MAX_ITEMS_PER_ORDER = 4;
const BCRYPT_COST = 10;
const DEMO_USER = 0;
const DEMO_BASKET = [0, 3, 6, 10, 13, 16];
const DEMO_CART = [1, 4];
const COLOURS = ["Hitam", "Putih", "Biru"];
const SIZES = ["M", "L"];
const PRICE_STEP_IDR = 25_000;

// the rest cascade from these
const ROOTS = [
	"users",
	"categories",
	"brands",
	"payment_methods",
	"shipping_methods",
];

type Product = (typeof catalogue.products)[number];
type Query = <T>(sql: string, bind?: unknown[]) => Promise<T[]>;

function price(product: Product): number {
	return product.discountPriceIdr ?? product.originalPriceIdr;
}

// one statement per table: a row-per-tuple INSERT would pass the 65535 bind ceiling
function statement(table: string, columns: string, casts: string[]): string {
	const unnest = casts.map((cast, i) => `$${i + 1}::${cast}[]`).join(", ");

	return `INSERT INTO ${table} (${columns}) SELECT * FROM UNNEST(${unnest})`;
}

function columnwise(casts: string[], rows: unknown[][]): unknown[][] {
	return casts.map((_, i) => rows.map((row) => row[i]));
}

async function insertMany(
	query: Query,
	table: string,
	columns: string,
	casts: string[],
	rows: unknown[][],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await query(statement(table, columns, casts), columnwise(casts, rows));
}

async function insertReturning(
	query: Query,
	table: string,
	columns: string,
	casts: string[],
	rows: unknown[][],
): Promise<number[]> {
	if (rows.length === 0) {
		return [];
	}

	// the driver hands BIGINT back as a string; every id here fits in 2^53
	const returned = await query<{ id: string }>(
		`${statement(table, columns, casts)} RETURNING id`,
		columnwise(casts, rows),
	);

	// identity values follow UNNEST order, so ascending id is input order
	return returned.map((row) => Number(row.id)).toSorted((a, b) => a - b);
}

async function seed(query: Query): Promise<string | undefined> {
	const rows = await query<{ seeded: boolean }>(
		"SELECT EXISTS (SELECT 1 FROM products) AS seeded",
	);

	if (rows[0]?.seeded === true) {
		return undefined;
	}

	faker.seed(FAKER_SEED);

	const categoryIds = await insertReturning(
		query,
		"categories",
		"name, icon, img",
		["text", "text", "text"],
		catalogue.categories.map((c) => [c.name, c.icon, c.img]),
	);
	const categoryByName = new Map(
		catalogue.categories.map((c, i) => [c.name, categoryIds[i]]),
	);

	const brandIds = await insertReturning(
		query,
		"brands",
		"name",
		["text"],
		catalogue.brands.map((b) => [b]),
	);
	const brandByName = new Map(catalogue.brands.map((b, i) => [b, brandIds[i]]));

	const productIds = await insertReturning(
		query,
		"products",
		"id_category, id_brand, name, description",
		["bigint", "bigint", "text", "text"],
		catalogue.products.map((p) => [
			categoryByName.get(p.category),
			brandByName.get(p.brand),
			p.name,
			p.description,
		]),
	);

	// colour on every product, size on every third, so the options views and
	// multi-variant aggregation see real rows
	const optionRows: unknown[][] = [];
	const tiers: Array<{ product: number; values: string[] }> = [];

	for (const [i] of catalogue.products.entries()) {
		const colours = COLOURS.slice(0, 2 + (i % 2));

		optionRows.push([productIds[i], 1, "Warna"]);
		tiers.push({ product: i, values: colours });

		if (i % 3 === 0) {
			optionRows.push([productIds[i], 2, "Ukuran"]);
			tiers.push({ product: i, values: SIZES });
		}
	}

	const optionIds = await insertReturning(
		query,
		"products_options",
		"id_product, tier, name",
		["bigint", "int", "text"],
		optionRows,
	);

	const valueRows: unknown[][] = [];
	const valueSpans = tiers.map(({ values }, t) => {
		const at = valueRows.length;

		for (const value of values) {
			valueRows.push([optionIds[t], value]);
		}

		return { at, values };
	});

	const valueIds = await insertReturning(
		query,
		"products_options_values",
		"id_option, name",
		["bigint", "text"],
		valueRows,
	);

	// the cheapest variant carries the catalogue price, so products_cheapest matches catalogue.json
	const plans = catalogue.products.map((p, i) => {
		const spans = valueSpans.filter((_, t) => tiers[t]!.product === i);
		const [colours, sizes] = spans;
		const combos: Array<{ values: number[]; label: string }> = [];

		for (const [c, colour] of (colours?.values ?? []).entries()) {
			if (sizes === undefined) {
				combos.push({ values: [colours!.at + c], label: colour });
				continue;
			}

			for (const [s, size] of sizes.values.entries()) {
				combos.push({
					values: [colours!.at + c, sizes.at + s],
					label: `${colour} / ${size}`,
				});
			}
		}

		const share = Math.floor(p.inventory / combos.length);

		return combos.map((combo, j) => ({
			product: i,
			values: combo.values,
			label: combo.label,
			// the remainder rides on the first variant so the total still sums to inventory
			stock: j === 0 ? share + (p.inventory % combos.length) : share,
			originalPriceIdr: p.originalPriceIdr + j * PRICE_STEP_IDR,
			discountPriceIdr: j === 0 ? p.discountPriceIdr : null,
		}));
	});

	const flat = plans.flat();

	const variantIds = await insertReturning(
		query,
		"products_variants",
		"id_product, sku, price, stock",
		["bigint", "text", "bigint", "int"],
		flat.map((v, n) => [
			productIds[v.product],
			`SKU-${productIds[v.product]}-${n}`,
			v.originalPriceIdr,
			v.stock,
		]),
	);

	await insertMany(
		query,
		"products_variants_options",
		"id_variant, id_value",
		["bigint", "bigint"],
		flat.flatMap((v, n) => v.values.map((at) => [variantIds[n], valueIds[at]])),
	);

	await insertMany(
		query,
		"products_price",
		"id_variant, original_price_idr, discount_price_idr",
		["bigint", "bigint", "bigint"],
		flat.map((v, n) => [variantIds[n], v.originalPriceIdr, v.discountPriceIdr]),
	);

	const firstVariant = new Map<number, number>();
	const labels = new Map<number, string>();
	const byProduct = new Map<number, number[]>();
	let at = 0;

	for (const [i, variants] of plans.entries()) {
		firstVariant.set(i, variantIds[at]!);
		labels.set(i, variants[0]!.label);
		byProduct.set(i, variantIds.slice(at, at + variants.length));
		at += variants.length;
	}

	// position is unique per product, so the cover takes 1 and the variants follow
	await insertMany(
		query,
		"products_images",
		"id_product, id_variant, position, url",
		["bigint", "bigint", "int", "text"],
		[
			...catalogue.products.map((p, i) => [productIds[i], null, 1, p.img]),
			...flat.map((v, n) => [
				productIds[v.product],
				variantIds[n],
				2 + n - plans.slice(0, v.product).flat().length,
				catalogue.products[v.product]!.img,
			]),
		],
	);

	await insertMany(
		query,
		"shipping_methods",
		"name, cost_idr",
		["text", "bigint"],
		catalogue.shippingMethods.map((s) => [s.name, s.costIdr]),
	);

	const paymentIds = await insertReturning(
		query,
		"payment_methods",
		"name, metadata",
		["text", "json"],
		catalogue.paymentMethods.map((m) => [m.name, JSON.stringify(m.metadata)]),
	);

	// a user may rate a variant once, so the pool need only cover the most-rated product
	const raters = Math.max(...catalogue.products.map((p) => p.ratingCount));

	// bcrypt at cost 10 is ~60ms, so raters share one hash and only the demo login gets its own
	const raterHash = hashSync(
		faker.internet.password({ length: 32 }),
		BCRYPT_COST,
	);
	const demoHash = hashSync(DEMO_PASSWORD, BCRYPT_COST);

	const emails = [DEMO_EMAIL];
	const hashes = [demoHash];

	for (let n = 1; n <= raters; n++) {
		emails.push(`rater${n}${RATER_DOMAIN}`);
		hashes.push(raterHash);
	}

	const userIds = await insertReturning(
		query,
		"users",
		"email, password_hash",
		["text", "text"],
		emails.map((email, i) => [email, hashes[i]]),
	);

	// fullName() draws a middle name from the same pool as the first, so a third of them double up
	const names = userIds.map(
		() => `${faker.person.firstName()} ${faker.person.lastName()}`,
	);

	await insertMany(
		query,
		"profile",
		"id_user, name, phone",
		["bigint", "text", "text"],
		userIds.map((id, i) => [id, names[i], faker.phone.number()]),
	);

	await query(
		"INSERT INTO roles (id_user, role) SELECT * FROM UNNEST($1::bigint[], $2::user_role[])",
		[userIds, userIds.map(() => "customer")],
	);

	const addresses = userIds.map(() => faker.location.streetAddress());

	await insertMany(
		query,
		"users_address",
		"id_user, label, name, phone, address, city, province, postal_code, is_default",
		[
			"bigint",
			"text",
			"text",
			"text",
			"text",
			"text",
			"text",
			"text",
			"boolean",
		],
		userIds.map((id, i) => [
			id,
			"Rumah",
			names[i],
			faker.phone.number(),
			addresses[i],
			faker.location.city(),
			faker.location.state(),
			faker.location.zipCode(),
			true,
		]),
	);

	// one default per user, so the demo account takes the first method and the rest follow
	await insertMany(
		query,
		"users_payments",
		"id_user, id_payment, is_default, data",
		["bigint", "bigint", "boolean", "json"],
		paymentIds.map((id, i) => [
			userIds[DEMO_USER],
			id,
			i === 0,
			JSON.stringify({ label: catalogue.paymentMethods[i]!.name }),
		]),
	);

	// rater n buys every product whose ratingCount reaches n, so each rating has a real order
	const baskets = new Map<number, number[]>();

	for (const [index, product] of catalogue.products.entries()) {
		for (let n = 1; n <= product.ratingCount; n++) {
			baskets.set(n, [...(baskets.get(n) ?? []), index]);
		}
	}

	baskets.set(DEMO_USER, DEMO_BASKET);

	const orderRows: unknown[][] = [];
	const lines: Array<{ order: number; index: number; buyer: number }> = [];

	for (const [buyer, indexes] of baskets) {
		for (let at = 0; at < indexes.length; at += MAX_ITEMS_PER_ORDER) {
			const chunk = indexes.slice(at, at + MAX_ITEMS_PER_ORDER);
			const shipping =
				catalogue.shippingMethods[
					orderRows.length % catalogue.shippingMethods.length
				]!;

			for (const index of chunk) {
				lines.push({ order: orderRows.length, index, buyer });
			}

			orderRows.push([
				userIds[buyer],
				paymentIds[orderRows.length % paymentIds.length],
				chunk.reduce((sum, i) => sum + price(catalogue.products[i]!), 0),
				shipping.costIdr,
				names[buyer],
				faker.phone.number(),
				emails[buyer],
				addresses[buyer],
				shipping.name,
			]);
		}
	}

	const orderIds = await insertReturning(
		query,
		"orders",
		"id_user, payment_method, subtotal_idr, ship_cost_idr, ship_name, ship_phone, ship_email, ship_address, ship_method",
		[
			"bigint",
			"bigint",
			"bigint",
			"bigint",
			"text",
			"text",
			"text",
			"text",
			"text",
		],
		orderRows,
	);

	await insertMany(
		query,
		"orders_items",
		"id_order, id_variant, product_name, variant_name, unit_price_idr, quantity",
		["bigint", "bigint", "text", "text", "bigint", "int"],
		lines.map(({ order, index }) => [
			orderIds[order],
			firstVariant.get(index),
			catalogue.products[index]!.name,
			labels.get(index),
			price(catalogue.products[index]!),
			1,
		]),
	);

	// the nth purchaser scores 5 while inside the quota, so the rounded average matches data.json
	const nth = new Map<number, number>();

	// the demo account buys without rating, so its history does not disturb the counts
	const rated = lines.filter(({ buyer }) => buyer !== DEMO_USER);

	await insertMany(
		query,
		"ratings",
		"id_user, id_variant, rating",
		["bigint", "bigint", "int"],
		rated.map(({ index, buyer }) => {
			const seen = (nth.get(index) ?? 0) + 1;
			nth.set(index, seen);

			return [
				userIds[buyer],
				firstVariant.get(index),
				seen <= catalogue.products[index]!.fives ? 5 : 4,
			];
		}),
	);

	await insertMany(
		query,
		"cart_items",
		"id_user, id_variant, quantity",
		["bigint", "bigint", "int"],
		// the last variant, so the cart exercises variant_options, a non-null sku and the gallery
		DEMO_CART.map((index) => [
			userIds[DEMO_USER],
			byProduct.get(index)!.at(-1),
			1,
		]),
	);

	return `${catalogue.products.length} products, ${userIds.length} users, ${orderIds.length} orders, ${lines.length} items, ${rated.length} ratings`;
}

export async function up({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	const { sequelize } = queryInterface;

	const summary = await sequelize.transaction(async (transaction) => {
		const query: Query = async <T>(sql: string, bind?: unknown[]) => {
			const [rows] = await sequelize.query(sql, { bind, transaction });

			return rows as T[];
		};

		return seed(query);
	});

	if (summary === undefined) {
		console.log("already seeded, nothing to do");
	} else {
		console.log(`seeded ${summary}`);
		console.log(`log in as ${DEMO_EMAIL} with password ${DEMO_PASSWORD}`);
	}
}

export async function down({
	sequelize: { queryInterface },
}: UmzugContext): Promise<void> {
	await queryInterface.sequelize.query(
		`TRUNCATE ${ROOTS.join(", ")} RESTART IDENTITY CASCADE`,
	);
}
