import baseCors from "cors";
import type { RequestHandler } from "express";

const configured = baseCors({
	origin: "http://localhost:5173",
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
	allowedHeaders: ["Origin", "Content-Type", "Content-Length", "Authorization"],
	// browsers withhold non-safelisted response headers from JS unless named here
	exposedHeaders: ["Link", "X-Total-Count"],
});

// gin-contrib/cors answers a request without an Origin untouched; this matches it
export const cors: RequestHandler = (req, res, next) => {
	if (req.get("origin") === undefined) {
		next();
		return;
	}

	configured(req, res, next);
};
