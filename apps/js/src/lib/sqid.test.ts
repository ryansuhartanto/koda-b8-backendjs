import { expect, test } from "vite-plus/test";

import { decode, encode } from "#/lib/sqid";

const MIN_LENGTH = 6;
const NOT_AN_ID = "sqid ids must be non-negative safe integers";

test("round-trips across a wide id range", () => {
	const ids = [0, 1, 2, 9, 10, 99, 100, 1000, 123456, 2147483647];

	expect(ids.map((id) => decode(encode(id)))).toStrictEqual(ids);
	expect(ids.filter((id) => encode(id).length < MIN_LENGTH)).toStrictEqual([]);
});

test("rejects garbage and non-canonical forms", () => {
	const valid = encode(42);

	const cases: Record<string, string> = {
		"empty": "",
		"zero": "0",
		"out of alphabet": "!!!!!!",
		"padded": `${valid} `,
		"trailing garbage": `${valid}zzzz`,
		"non-canonical": `2${valid}`,
	};

	const accepted = Object.entries(cases)
		.filter(([, input]) => decode(input) !== undefined)
		.map(([name]) => name);

	expect(accepted).toStrictEqual([]);
});

test("rejects a negative id", () => {
	expect(() => encode(-1)).toThrow(NOT_AN_ID);
});

// the two services must agree byte for byte, so the alphabet is pinned in source
test("encodes to the value the Go service produces", () => {
	expect(encode(1)).toBe("MCLHrR");
});
