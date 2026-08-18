import jwt from "jsonwebtoken";

export const TTL = "24h";

export type Claims = {
	idUser: number;
	roles: string[];
};

function secret(): string {
	return process.env["JWT_SECRET"] ?? "";
}

export function sign(idUser: number, roles: string[]): string {
	return jwt.sign({ roles }, secret(), {
		algorithm: "HS256",
		subject: String(idUser),
		expiresIn: TTL,
	});
}

export function parse(raw: string): Claims {
	// reject algorithm confusion
	const claims = jwt.verify(raw, secret(), { algorithms: ["HS256"] });

	if (typeof claims === "string" || claims.sub === undefined) {
		throw new Error("token has no subject");
	}

	const roles: unknown = claims["roles"];

	return {
		idUser: Number(claims.sub),
		// a token issued before roles were claimed carries none, so it is not an admin
		roles: Array.isArray(roles)
			? roles.filter((r) => typeof r === "string")
			: [],
	};
}
