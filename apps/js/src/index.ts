import { createServer } from "node:http";
import type { RequestListener } from "node:http";

import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import type { ConsoleFormatter } from "@logtape/logtape";

import app from "#/app";
import { pool } from "#/lib/db";

const port = Number(process.env["JS_PORT"] ?? "3002");

const formatter: ConsoleFormatter = (r) => {
	const tag = `[${r.category.join("-").toUpperCase()}]`;
	const timestamp = new Date(r.timestamp)
		.toISOString()
		.slice(0, -5)
		.replace("T", " - ");

	const p = r.properties;
	if (p["methods"]) {
		return [
			tag,
			timestamp,
			"|",
			(p["methods"] as string[]).join(",").padEnd(7),
			`"${p["path"] as string}"`,
		];
	}
	if (p["status"] !== undefined) {
		return [
			tag,
			timestamp,
			"|",
			(p["status"] as string).padStart(3),
			"|",
			`${String(p["responseTime"]).padStart(8)}ms`,
			"|",
			(p["remoteAddr"] as string).padStart(15),
			"|",
			(p["method"] as string).padEnd(6),
			`"${(p["path"] as string) ?? (p["url"] as string)}"`,
		];
	}
	return [tag, timestamp, "|", r.message];
};

await configure({
	sinks: { console: getConsoleSink({ formatter }) },
	loggers: [
		{
			category: ["exp"],
			sinks: ["console"],
			lowestLevel: "debug",
		},
		{
			category: ["logtape", "meta"],
			sinks: [],
		},
	],
});

const log = getLogger("exp");

const server = createServer(app as RequestListener);

const run = server.listen(port, () => {
	for (const layer of app.router.stack) {
		if (!layer.route) {
			continue;
		}

		log.debug("{methods} {path}", {
			methods: Array.from(
				new Set(layer.route.stack.map((h) => h.method)),
				(method) => method.toUpperCase(),
			),
			path: layer.route.path,
		});
	}
});

// oxlint-disable no-console unicorn/no-process-exit
function shutdown(signal: string): void {
	log.debug(`Received ${signal}. Cleaning up resources...`);

	setTimeout(() => {
		log.error("Forcefully shutting down due to timeout.");
		process.exit(1);
	}, 5000);

	run.close(() => {
		void pool.end();

		log.debug("HTTP server closed.");
		process.exit(0);
	});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
