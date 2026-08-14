import { expect, test } from "vite-plus/test";

import { go, js, reachable } from "#/client";

const live = await reachable();

const services = [
	{ name: "go", base: go },
	{ name: "js", base: js },
];

type Session = { socket: WebSocket; frames: string[] };

// node's WebSocket sends "Connection: upgrade" in lower case, which is the
// spelling the go library used to reject, so connecting at all is the assertion
async function connect(base: string): Promise<Session> {
	const socket = new WebSocket(
		`${base.replace("http", "ws")}/socket.io/?EIO=4&transport=websocket`,
	);
	const frames: string[] = [];

	socket.addEventListener("message", (event) => {
		frames.push(String(event.data));
	});

	await new Promise((resolve, reject) => {
		socket.addEventListener("open", resolve, { once: true });
		socket.addEventListener(
			"error",
			() => reject(new Error(`${base} refused the upgrade`)),
			{ once: true },
		);
		setTimeout(() => reject(new Error(`${base} did not upgrade in 4s`)), 4000);
	});

	return { socket, frames };
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

		// the sid and the advertised upgrades differ, the timings must not
		expect(jsOpen?.["pingInterval"]).toBe(goOpen?.["pingInterval"]);
		expect(jsOpen?.["pingTimeout"]).toBe(goOpen?.["pingTimeout"]);
		expect(jsOpen?.["maxPayload"]).toBe(goOpen?.["maxPayload"]);
	} finally {
		for (const session of sessions) {
			session.socket.close();
		}
	}
});
