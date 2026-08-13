import Sqids from "sqids";

// obfuscation rather than a secret: both services must agree on it byte for byte,
// so it is a constant here instead of an environment variable that could drift
const ALPHABET =
	"2V0Q9JjRCEi6wtHTrIlgAXFLyBp53emSYs8GzUMN1OZDbocfh4quPn7adWxKkv";
const MIN_LENGTH = 6;

const sqids = new Sqids({ alphabet: ALPHABET, minLength: MIN_LENGTH });

export function encode(id: number): string {
	if (!Number.isSafeInteger(id) || id < 0) {
		throw new RangeError("sqid ids must be non-negative safe integers");
	}

	return sqids.encode([id]);
}

export function decode(s: string): number | undefined {
	const ids = sqids.decode(s);
	const [id] = ids;

	if (ids.length !== 1 || id === undefined || !Number.isSafeInteger(id)) {
		return undefined;
	}

	// padded and out-of-alphabet forms still decode; round-tripping rejects them
	return sqids.encode([id]) === s ? id : undefined;
}
