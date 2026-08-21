import { encode } from "#/lib/sqid";

const ID = /^id(_|$)/;

// no fractional seconds, which keeps this byte-identical to the Go service
const INSTANT = new Set(["created_at", "updated_at"]);

function instant(value: unknown): string {
	return `${new Date(value as string).toISOString().slice(0, 19)}Z`;
}

/**
 * Projects a row onto its wire form: null columns lose their key, id columns
 * become sqids, timestamps become RFC 3339 seconds. Recursive because the
 * aggregate views nest rows inside JSON.
 */
export function wire(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(wire);
	}

	if (value === null || typeof value !== "object" || value instanceof Date) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).flatMap(([key, inner]) => {
			if (inner === null || inner === undefined) {
				return [];
			}

			if (INSTANT.has(key)) {
				return [[key, instant(inner)]];
			}

			if (ID.test(key) && typeof inner === "number") {
				return [[key, encode(inner)]];
			}

			return [[key, wire(inner)]];
		}),
	);
}
