export const AUTH_REQUEST_MAX_BYTES = 8 * 1024;
export const PUBLICATION_REQUEST_MAX_BYTES = 4 * 1024;
export const HOSTED_COMMAND_REQUEST_MAX_BYTES = 2 * 1024;
export const WORLD_REQUEST_MAX_BYTES = 1024 * 1024 + 16 * 1024;

export class RequestBodyError extends Error {
	constructor(readonly code: "INVALID_JSON" | "REQUEST_TOO_LARGE") {
		super(
			code === "REQUEST_TOO_LARGE"
				? "The request body is too large."
				: "The request body must contain valid JSON.",
		);
		this.name = "RequestBodyError";
	}
}

export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maximumBytes)
		throw new RequestBodyError("REQUEST_TOO_LARGE");
	const text = await request.text();
	if (new TextEncoder().encode(text).byteLength > maximumBytes)
		throw new RequestBodyError("REQUEST_TOO_LARGE");
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new RequestBodyError("INVALID_JSON");
	}
}
