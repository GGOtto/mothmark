/** @jest-environment node */

import {
	PASSWORD_HASH_VERSION,
	PasswordValidationError,
	hashPassword,
	passwordNeedsRehash,
	validatePassword,
	verifyAndUpgradePassword,
	verifyPassword,
} from "./passwords";

describe("registered-account password security", () => {
	it("hashes with unique Argon2id salts and verifies without retaining plaintext", async () => {
		const first = await hashPassword("a careful mothmark passphrase");
		const second = await hashPassword("a careful mothmark passphrase");
		expect(first.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
		expect(second.passwordHash).not.toBe(first.passwordHash);
		expect(JSON.stringify(first)).not.toContain("a careful mothmark passphrase");
		await expect(verifyPassword(first.passwordHash, "a careful mothmark passphrase")).resolves.toBe(
			true,
		);
		await expect(verifyPassword(first.passwordHash, "a wrong password value")).resolves.toBe(false);
	});

	it("rejects short, oversized, and compromised values", () => {
		expect(() => validatePassword("too short")).toThrow(PasswordValidationError);
		expect(() => validatePassword("x".repeat(129))).toThrow(PasswordValidationError);
		expect(() => validatePassword("password1234")).toThrow(
			"Choose a password that is not commonly compromised.",
		);
	});

	it("detects versioned work-factor upgrades and rehashes after valid authentication", async () => {
		const stored = await hashPassword("another durable password");
		expect(passwordNeedsRehash(stored)).toBe(false);
		const old = {...stored, hashVersion: PASSWORD_HASH_VERSION - 1};
		expect(passwordNeedsRehash(old)).toBe(true);
		const result = await verifyAndUpgradePassword(old, "another durable password");
		expect(result.valid).toBe(true);
		expect(result.upgraded?.hashVersion).toBe(PASSWORD_HASH_VERSION);
	});
});
