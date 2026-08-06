import { writeFile } from "node:fs/promises";

import swaggerJSDoc from "swagger-jsdoc";

const spec: Record<string, unknown> = swaggerJSDoc({
	failOnErrors: true,
	definition: {
		openapi: "3.1.0",
		info: {
			title: "BeliMudah API",
			version: "1.0",
			description: "E-commerce API for the BeliMudah storefront.",
			contact: {
				name: "Ryan Suhartanto",
				url: "https://github.com/ryansuhartanto/koda-b8-backend",
				email: "suhartanto@kekkon.nexus",
			},
			license: { name: "MIT" },
		},
		servers: [{ url: "http://localhost:3002" }],
		components: {
			securitySchemes: {
				BearerAuth: { type: "http", scheme: "bearer" },
			},
			schemas: {
				Problem: {
					type: "object",
					properties: {
						title: { type: "string" },
						status: { type: "integer" },
						detail: { type: "string" },
					},
					required: ["title", "status"],
				},
			},
		},
	},
	apis: [`${import.meta.dirname}/../src/**/*.ts`],
}) as Record<string, unknown>;

// swagger-jsdoc always emits this; swag emits nothing
if (Array.isArray(spec["tags"]) && spec["tags"].length === 0) {
	delete spec["tags"];
}

if (import.meta.main) {
	await writeFile(
		new URL("swagger.json", import.meta.url),
		`${JSON.stringify(spec, null, "\t")}\n`,
	);
}
