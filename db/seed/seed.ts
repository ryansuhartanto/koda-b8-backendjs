import { fakerID_ID as faker } from "@faker-js/faker";
import { hashSync } from "bcryptjs";
import { Pool, types } from "pg";
import type { PoolClient } from "pg";

import catalogue from "#/catalogue.json" with { type: "json" };

// pg hands BIGINT back as a string to protect precision it cannot represent, and every id here
// sits well inside 2^53
types.setTypeParser(types.builtins.INT8, Number);

const FAKER_SEED = 676767;
const DEMO_EMAIL = "demo@belimudah.test";
const DEMO_PASSWORD = "demo1234";
const RATER_DOMAIN = "@belimudah.test";
const MAX_ITEMS_PER_ORDER = 4;
const BCRYPT_COST = 10;
const DEMO_USER = 0;
const DEMO_BASKET = [0, 3, 6, 10, 13, 16];
const DEMO_CART = [1, 4];

type Product = (typeof catalogue.products)[number];
type Client = PoolClient;

function price(product: Product): number {
	return product.discountPriceIdr ?? product.originalPriceIdr;
}

// one statement per table however many rows, because 8209 line items would blow past the 65535
// bind parameter ceiling a row-per-tuple INSERT would need
function statement(table: string, columns: string, casts: string[]): string {
	const unnest = casts.map((cast, i) => `$${i + 1}::${cast}[]`).join(", ");

	return `INSERT INTO ${table} (${columns}) SELECT * FROM UNNEST(${unnest})`;
}

function columnwise(casts: string[], rows: unknown[][]): unknown[][] {
	return casts.map((_, i) => rows.map((row) => row[i]));
}

async function insertMany(
	client: Client,
	table: string,
	columns: string,
	casts: string[],
	rows: unknown[][],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await client.query(statement(table, columns, casts), columnwise(casts, rows));
}

async function insertReturning(
	client: Client,
	table: string,
	columns: string,
	casts: string[],
	rows: unknown[][],
): Promise<number[]> {
	if (rows.length === 0) {
		return [];
	}

	const { rows: returned } = await client.query<{ id: number }>(
		`${statement(table, columns, casts)} RETURNING id`,
		columnwise(casts, rows),
	);

	// identity values are handed out in the order UNNEST yields rows, so ascending id is input order
	return returned.map((row) => row.id).toSorted((a, b) => a - b);
}

async function seed(client: Client): Promise<string | undefined> {
	const { rows } = await client.query<{ seeded: boolean }>(
		"SELECT EXISTS (SELECT 1 FROM products) AS seeded",
	);

	if (rows[0]?.seeded === true) {
		return undefined;
	}

	faker.seed(FAKER_SEED);

	const categoryIds = await insertReturning(
		client,
		"categories",
		"name, icon, img",
		["text", "text", "text"],
		catalogue.categories.map((c) => [c.name, c.icon, c.img]),
	);
	const categoryByName = new Map(
		catalogue.categories.map((c, i) => [c.name, categoryIds[i]]),
	);

	const brandIds = await insertReturning(
		client,
		"brands",
		"name",
		["text"],
		catalogue.brands.map((b) => [b]),
	);
	const brandByName = new Map(catalogue.brands.map((b, i) => [b, brandIds[i]]));

	const productIds = await insertReturning(
		client,
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

	const variantIds = await insertReturning(
		client,
		"products_variants",
		"id_product, position, inventory, name",
		["bigint", "int", "int", "text"],
		catalogue.products.map((p, i) => [
			productIds[i],
			0,
			p.inventory,
			"Standar",
		]),
	);

	await insertMany(
		client,
		"products_price",
		"id_variant, original_price_idr, discount_price_idr",
		["bigint", "bigint", "bigint"],
		catalogue.products.map((p, i) => [
			variantIds[i],
			p.originalPriceIdr,
			p.discountPriceIdr,
		]),
	);

	await insertMany(
		client,
		"products_images",
		"id_product, url",
		["bigint", "text"],
		catalogue.products.map((p, i) => [productIds[i], p.img]),
	);

	await insertMany(
		client,
		"shipping_methods",
		"name, cost_idr",
		["text", "bigint"],
		catalogue.shippingMethods.map((s) => [s.name, s.costIdr]),
	);

	// a user may rate every product but never the same variant twice, so the pool only has to cover
	// the single most-rated product rather than the sum
	const raters = Math.max(...catalogue.products.map((p) => p.ratingCount));

	// bcrypt at cost 10 costs roughly 60ms, so the raters share one hash of a discarded secret and
	// only the demo login gets its own
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
		client,
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
		client,
		"profile",
		"id_user, name, phone",
		["bigint", "text", "text"],
		userIds.map((id, i) => [id, names[i], faker.phone.number()]),
	);

	await client.query(
		"INSERT INTO roles (id_user, role) SELECT * FROM UNNEST($1::bigint[], $2::user_role[])",
		[userIds, userIds.map(() => "customer")],
	);

	const addresses = userIds.map(() => faker.location.streetAddress());

	await insertMany(
		client,
		"saved_address",
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

	// rater n buys every product whose ratingCount reaches n, which lands each product exactly the
	// purchaser count data.json claims while keeping every rating attached to a real order
	const baskets = new Map<number, number[]>();

	for (const [index, product] of catalogue.products.entries()) {
		for (let n = 1; n <= product.ratingCount; n++) {
			baskets.set(n, [...(baskets.get(n) ?? []), index]);
		}
	}

	// the demo account is user 0 and the raters start at 1, so it needs a basket of its own
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
				"transfer",
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
		client,
		"orders",
		"id_user, payment_method, subtotal_idr, ship_cost_idr, ship_name, ship_phone, ship_email, ship_address, ship_method",
		[
			"bigint",
			"text",
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
		client,
		"order_items",
		"id_order, id_variant, product_name, variant_name, unit_price_idr, quantity",
		["bigint", "bigint", "text", "text", "bigint", "int"],
		lines.map(({ order, index }) => [
			orderIds[order],
			variantIds[index],
			catalogue.products[index]!.name,
			"Standar",
			price(catalogue.products[index]!),
			1,
		]),
	);

	// the nth purchaser of a product scores 5 while n is inside its quota, which makes the rounded
	// average land on the figure data.json claims
	const nth = new Map<number, number>();

	// the demo account buys without rating, so its history does not disturb the counts above
	const rated = lines.filter(({ buyer }) => buyer !== DEMO_USER);

	await insertMany(
		client,
		"ratings",
		"id_user, id_variant, rating",
		["bigint", "bigint", "int"],
		rated.map(({ index, buyer }) => {
			const seen = (nth.get(index) ?? 0) + 1;
			nth.set(index, seen);

			return [
				userIds[buyer],
				variantIds[index],
				seen <= catalogue.products[index]!.fives ? 5 : 4,
			];
		}),
	);

	await insertMany(
		client,
		"cart_items",
		"id_user, id_variant, quantity",
		["bigint", "bigint", "int"],
		DEMO_CART.map((index) => [userIds[DEMO_USER], variantIds[index], 1]),
	);

	return `${catalogue.products.length} products, ${userIds.length} users, ${orderIds.length} orders, ${lines.length} items, ${rated.length} ratings`;
}

const pool = new Pool();
const client = await pool.connect();

try {
	await client.query("BEGIN");
	const summary = await seed(client);
	await client.query("COMMIT");

	if (summary === undefined) {
		console.log("already seeded, nothing to do");
	} else {
		console.log(`seeded ${summary}`);
		console.log(`log in as ${DEMO_EMAIL} with password ${DEMO_PASSWORD}`);
	}
} catch (error) {
	await client.query("ROLLBACK");
	throw error;
} finally {
	client.release();
	await pool.end();
}
