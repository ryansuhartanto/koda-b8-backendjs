import type { Request, Response } from "express";

// RFC 8288 Link header
export function pagination(
	req: Request,
	res: Response,
	total: number,
	limit: number,
	offset: number,
): void {
	res.set("X-Total-Count", String(total));

	const url = new URL(req.originalUrl, "http://localhost");

	const page = (rel: string, at: number): string => {
		url.searchParams.set("limit", String(limit));
		url.searchParams.set("offset", String(at));
		// Go's url.Values.Encode sorts by key; match it so both implementations agree
		url.searchParams.sort();

		return `<${url.pathname}${url.search}>; rel="${rel}"`;
	};

	// floor to the page boundary; max keeps an empty result from going negative
	const last = Math.floor((Math.max(total, 1) - 1) / limit) * limit;

	const links = [page("self", offset), page("first", 0), page("last", last)];

	if (offset > 0) {
		links.push(page("prev", Math.max(0, offset - limit)));
	}

	if (offset + limit < total) {
		links.push(page("next", offset + limit));
	}

	res.set("Link", links.join(", "));
}
