export type Scenario = {
	name: string;
	path: string;
	method?: "GET" | "POST" | "DELETE";
	auth?: boolean;
	body?: unknown;
};

// Both services read one database, so a scenario that only reads sees identical
// rows and its responses must match byte for byte, key order included.
export const reads: Scenario[] = [
	{ name: "product list", path: "/products?limit=3" },
	{ name: "product list, paged", path: "/products?limit=2&offset=2" },
	{
		name: "product list, price_desc",
		path: "/products?sort=price_desc&limit=3",
	},
	{ name: "product list, rating", path: "/products?sort=rating&limit=3" },
	{
		name: "product list, filtered",
		path: "/products?category=Elektronik&limit=3",
	},
	{ name: "product list, searched", path: "/products?search=yoga" },
	{ name: "single product", path: "/products/0Jtbd2" },
	{
		name: "single product, slugged",
		path: "/products/0Jtbd2/raket-badminton-carbon-pro",
	},
	{ name: "shipping methods", path: "/shipping-methods" },
	{ name: "cart", path: "/cart", auth: true },
	{ name: "addresses", path: "/addresses", auth: true },
	{ name: "orders", path: "/orders", auth: true },
];

// Rejections happen before any query, so these need no fixture state at all.
export const errors: Scenario[] = [
	{ name: "unknown sort", path: "/products?sort=bogus" },
	{ name: "limit above maximum", path: "/products?limit=9999" },
	{ name: "limit below minimum", path: "/products?limit=0" },
	{ name: "non-numeric limit", path: "/products?limit=abc" },
	{ name: "negative offset", path: "/products?offset=-1" },
	{ name: "malformed sqid", path: "/products/!!!!!!" },
	{ name: "unknown product", path: "/products/zzzzzzz" },
	{ name: "cart without a token", path: "/cart" },
	{ name: "orders without a token", path: "/orders" },
	{ name: "addresses without a token", path: "/addresses" },
	{ name: "cart with a junk token", path: "/cart", auth: false, method: "GET" },
	{
		name: "register with an incomplete body",
		path: "/auth/register",
		method: "POST",
		body: { name: "x" },
	},
	{
		name: "login with an empty body",
		path: "/auth/login",
		method: "POST",
		body: {},
	},
	{
		name: "cart with an empty body",
		path: "/cart",
		method: "POST",
		auth: true,
		body: {},
	},
	{
		name: "order with an empty body",
		path: "/orders",
		method: "POST",
		auth: true,
		body: {},
	},
	{
		name: "address with an incomplete body",
		path: "/addresses",
		method: "POST",
		auth: true,
		body: { label: "Rumah" },
	},
];
