import type { Server as HttpServer } from "node:http";

import { getLogger } from "@logtape/logtape";
import { Server } from "socket.io";

import { room } from "#/lib/notify";
import { parse } from "#/lib/token";
import type { Claims } from "#/lib/token";

export function createSocket(server: HttpServer): Server {
	const log = getLogger(["exp", "sock"]);

	const io = new Server(server, {
		cors: {
			origin: true,
		},
		// socket.io defaults to 20s, the go library hardcodes 25s with no setter
		pingTimeout: 25_000,
	});

	io.on("connection", (socket) => {
		log.info("Connected", { id: socket.id });

		socket.on("auth", (raw: unknown) => {
			let claims: Claims;

			try {
				claims = parse(String(raw));
			} catch {
				socket.emit("auth", { ok: false });
				return;
			}

			void socket.join(room(claims.idUser));
			socket.emit("auth", { ok: true });
		});

		socket.on("chat", (msg) => {
			log.debug("Chat", { id: socket.id, msg });
		});
		socket.on("disconnect", (reason) => {
			log.info("Disconnect", { id: socket.id, reason });
		});
	});

	return io;
}
