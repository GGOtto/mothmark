/** @jest-environment node */

import {
	createTotpSecret,
	decryptTotpSecret,
	encryptTotpSecret,
	totpCode,
	totpEnrollmentUri,
	verifyTotp,
} from "./totp";

const key = Buffer.alloc(32, 7).toString("base64");

describe("administrator TOTP", () => {
	it("encrypts authenticator secrets and produces standard enrollment URIs", () => {
		const secret = createTotpSecret();
		const encrypted = encryptTotpSecret(secret, key);
		expect(encrypted).not.toContain(secret);
		expect(decryptTotpSecret(encrypted, key)).toBe(secret);
		expect(totpEnrollmentUri("admin@example.com", secret)).toContain("otpauth://totp/");
	});

	it("accepts a nearby TOTP counter once and rejects replay", () => {
		const now = new Date("2026-08-08T12:00:00.000Z");
		const counter = Math.floor(now.getTime() / 1_000 / 30);
		const secret = createTotpSecret();
		const code = totpCode(secret, counter);
		expect(verifyTotp(secret, code, {now})).toBe(counter);
		expect(verifyTotp(secret, code, {lastUsedCounter: counter, now})).toBeUndefined();
		expect(verifyTotp(secret, "00000x", {now})).toBeUndefined();
	});
});
