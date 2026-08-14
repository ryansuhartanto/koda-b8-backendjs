export function contract(spec: Record<string, unknown>): unknown {
	const { servers: _servers, externalDocs: _externalDocs, ...rest } = spec;

	return rest;
}
