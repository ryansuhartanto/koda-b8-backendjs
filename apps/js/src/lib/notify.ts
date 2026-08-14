import { getLogger } from "@logtape/logtape";
import { Client } from "pg";
import type { Server } from "socket.io";

import { encode } from "#/lib/sqid";

type Change = {
	table: string;
	op: string;
	id: number;
	id_user?: number;
};

export const CHANNEL = "changes";

export function room(idUser: number): string {
	return `user:${encode(idUser)}`;
}

export async function listen(io: Server): Promise<Client> {
	const log = getLogger(["exp", "sock"]);
	const client = new Client();

	await client.connect();

	client.on("notification", (message) => {
		if (message.payload === undefined) {
			return;
		}

		const change = JSON.parse(message.payload) as Change;
		const event = change.table === "orders" ? "order" : "product";
		const body = { op: change.op, id: encode(change.id) };

		log.debug("Change", { event, ...body });

		// the payload carries a json null for a product, not an absent key
		if (typeof change.id_user !== "number") {
			io.emit(event, body);
			return;
		}

		io.to(room(change.id_user)).emit(event, body);
	});

	await client.query(`LISTEN ${CHANNEL}`);

	return client;
}
