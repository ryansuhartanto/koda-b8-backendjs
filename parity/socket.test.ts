import { expect, test } from "vite-plus/test";

import { discover, fixture, go, js, reachable } from "#/client";

const live = await reachable();

const services = [
	{ name: "go", base: go },
	{ name: "js", base: js },
];

type Session = { socket: WebSocket; frames: string[] };

// node sends "Connection: upgrade" in lower case, which the go library rejected
async function attempt(base: string): Promise<Session | undefined> {
	const socket = new WebSocket(
		`${base.replace("http", "ws")}/socket.io/?EIO=4&transport=websocket`,
	);
	const frames: string[] = [];

	socket.addEventListener("message", (event) => {
		frames.push(String(event.data));
	});

	const opened = await new Promise<boolean>((resolve) => {
		socket.addEventListener("open", () => resolve(true), { once: true });
		socket.addEventListener("error", () => resolve(false), { once: true });
		setTimeout(() => resolve(false), 4000);
	});

	if (opened) {
		return { socket, frames };
	}

	// still connecting, and that keeps the run alive
	socket.close();
	return undefined;
}

// bun drops the first upgrade per service
async function connect(base: string): Promise<Session> {
	const session = (await attempt(base)) ?? (await attempt(base));

	if (!session) {
		throw new Error(`${base} did not upgrade in 4s, twice`);
	}

	return session;
}

async function awaitFrames(session: Session, count: number): Promise<string[]> {
	for (
		let waited = 0;
		waited < 2000 && session.frames.length < count;
		waited += 25
	) {
		await new Promise((resolve) => setTimeout(resolve, 25));
	}

	return session.frames;
}

async function open(base: string): Promise<Session> {
	const session = await connect(base);

	session.socket.send("40");
	await awaitFrames(session, 2);

	return session;
}

function events(session: Session, name: string): string[] {
	return session.frames
		.map((frame) => frame.trim())
		.filter((frame) => frame.startsWith(`42["${name}"`));
}

async function authenticate(session: Session, token: string): Promise<string> {
	const before = session.frames.length;

	session.socket.send(`42["auth","${token}"]`);
	await awaitFrames(session, before + 1);

	return events(session, "auth").join("");
}

function payload(frame: string, prefix: string): Record<string, unknown> {
	expect(frame.startsWith(prefix)).toBe(true);

	return JSON.parse(frame.slice(prefix.length)) as Record<string, unknown>;
}

test.skipIf(!live).each(services)(
	"$name upgrades over ws and completes the socket.io handshake",
	async ({ base }) => {
		const session = await connect(base);

		try {
			const [engine] = await awaitFrames(session, 1);
			const open = payload(engine ?? "", "0");

			expect(open["sid"]).toBeTypeOf("string");
			expect(open["pingInterval"]).toBeTypeOf("number");
			expect(open["pingTimeout"]).toBeTypeOf("number");

			session.socket.send("40");

			const [, namespace] = await awaitFrames(session, 2);

			expect(payload(namespace ?? "", "40")["sid"]).toBeTypeOf("string");
		} finally {
			session.socket.close();
		}
	},
);

test.skipIf(!live).each(services)(
	"$name stays connected after an emit",
	async ({ base }) => {
		const session = await connect(base);

		try {
			session.socket.send("40");
			await awaitFrames(session, 2);

			session.socket.send('42["chat","parity probe"]');
			await new Promise((resolve) => setTimeout(resolve, 300));

			expect(session.socket.readyState).toBe(WebSocket.OPEN);
			expect(session.frames.some((frame) => frame.startsWith("44"))).toBe(
				false,
			);
		} finally {
			session.socket.close();
		}
	},
);

test.skipIf(!live)("both services agree on the handshake shape", async () => {
	const sessions = await Promise.all([connect(go), connect(js)]);

	try {
		const [goOpen, jsOpen] = await Promise.all(
			sessions.map(async (session) => {
				const frames = await awaitFrames(session, 1);

				return payload(frames[0] ?? "", "0");
			}),
		);

		expect(jsOpen?.["pingInterval"]).toBe(goOpen?.["pingInterval"]);
		expect(jsOpen?.["pingTimeout"]).toBe(goOpen?.["pingTimeout"]);
		expect(jsOpen?.["maxPayload"]).toBe(goOpen?.["maxPayload"]);
	} finally {
		for (const session of sessions) {
			session.socket.close();
		}
	}
});

test.skipIf(!live).each(services)(
	"$name refuses a bad token",
	async ({ base }) => {
		const session = await open(base);

		try {
			await expect(authenticate(session, "not-a-jwt")).resolves.toBe(
				'42["auth",{"ok":false}]',
			);
		} finally {
			session.socket.close();
		}
	},
);

test.skipIf(!live)(
	"an order reaches its owner on every service, whichever one wrote it",
	async () => {
		const catalog = await discover(go);
		const state = await fixture(go, "socket", catalog);

		const owners = await Promise.all([open(go), open(js)]);
		const stranger = await open(js);

		try {
			for (const owner of owners) {
				await expect(authenticate(owner, state.token)).resolves.toBe(
					'42["auth",{"ok":true}]',
				);
			}

			const res = await fetch(`${go}/me/orders`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"authorization": `Bearer ${state.token}`,
				},
				body: JSON.stringify({
					id_address: state.address,
					id_payment: state.payment,
					ship_method: "JNE Reguler",
				}),
			});

			expect(res.status).toBe(201);

			await new Promise((resolve) => setTimeout(resolve, 1200));

			const [fromGo, fromJs] = owners.map((owner) => events(owner, "order"));

			expect(fromGo).toHaveLength(1);
			expect(fromJs).toStrictEqual(fromGo);
			expect(events(stranger, "order")).toStrictEqual([]);
		} finally {
			for (const session of [...owners, stranger]) {
				session.socket.close();
			}
		}
	},
);
