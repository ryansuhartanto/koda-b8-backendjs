// oxlint-disable no-console unicorn/no-process-exit
import app from "#/app";
import { pool } from "#/lib/db";

const port = Number(process.env["JS_PORT"] ?? "3002");

const server = app.listen(port, () => {
	console.log(`JS service listening on port ${port}`);
});

function shutdown(signal: string): void {
	console.log(`Received ${signal}. Cleaning up resources...`);

	setTimeout(() => {
		console.error("Forcefully shutting down due to timeout.");
		process.exit(1);
	}, 5000);

	server.close(() => {
		void pool.end();

		console.log("HTTP server closed.");
		process.exit(0);
	});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
