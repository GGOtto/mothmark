import {createHash, randomBytes, timingSafeEqual} from "node:crypto";

export {EDITOR_CSRF_COOKIE, EDITOR_SESSION_COOKIE} from "./cookieNames";
export const EDITOR_SESSION_DURATION_MS = 180 * 24 * 60 * 60 * 1_000;

export function createOpaqueToken(): string {
	return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokensMatch(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left, "utf8");
	const rightBuffer = Buffer.from(right, "utf8");
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function readCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("cookie");
	if (!header) return undefined;

	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() === name) {
			try {
				return decodeURIComponent(part.slice(separator + 1).trim());
			} catch {
				return undefined;
			}
		}
	}

	return undefined;
}
