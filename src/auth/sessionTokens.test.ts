/** @jest-environment node */

import {createOpaqueToken, hashSessionToken, readCookie, tokensMatch} from "./sessionTokens";

describe("session token security", () => {
	it("creates opaque random credentials and stores only deterministic hashes", () => {
		const first = createOpaqueToken();
		const second = createOpaqueToken();
		expect(first).toHaveLength(43);
		expect(second).not.toBe(first);
		expect(hashSessionToken(first)).toHaveLength(64);
		expect(hashSessionToken(first)).not.toContain(first);
		expect(hashSessionToken(first)).toBe(hashSessionToken(first));
	});

	it("compares CSRF tokens without accepting different values", () => {
		expect(tokensMatch("same", "same")).toBe(true);
		expect(tokensMatch("same", "different")).toBe(false);
	});

	it("treats malformed or absent cookies as missing", () => {
		expect(readCookie(new Request("http://localhost"), "session")).toBeUndefined();
		expect(
			readCookie(
				new Request("http://localhost", {headers: {cookie: "other=x; session=opaque%20token"}}),
				"session",
			),
		).toBe("opaque token");
		expect(
			readCookie(new Request("http://localhost", {headers: {cookie: "session=%not-uri"}}), "session"),
		).toBeUndefined();
	});
});
