import baseCors from "cors";
import type { RequestHandler } from "express";

export const cors: RequestHandler = baseCors({
	origin: "http://localhost:5173",
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
	allowedHeaders: ["Origin", "Content-Type", "Content-Length", "Authorization"],
	// browsers withhold non-safelisted response headers from JS unless named here
	exposedHeaders: ["Link", "X-Total-Count"],
});
