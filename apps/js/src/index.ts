import app from "#/app";

const port = Number(process.env["JS_PORT"] ?? "3002");

app.listen(port, () => {
	// oxlint-disable-next-line no-console
	console.log(`JS service listening on port ${port}`);
});
