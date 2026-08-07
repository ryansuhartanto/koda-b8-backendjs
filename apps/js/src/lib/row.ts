// pg yields NULL for nullable columns; drop them so the key is absent rather than null
export function defined<T extends Record<string, unknown>>(row: T): T {
	return Object.fromEntries(
		Object.entries(row).filter(([, value]) => value !== null),
	) as T;
}
