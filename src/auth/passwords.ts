import "server-only";

import {hash, verify} from "@node-rs/argon2";

export const PASSWORD_HASH_VERSION = 1;
const PASSWORD_ALGORITHM_ARGON2ID = 2;
export const PASSWORD_PARAMETERS = Object.freeze({
	memoryCost: 65_536,
	outputLen: 32,
	parallelism: 1,
	timeCost: 4,
});

export type StoredPassword = {
	passwordHash: string;
	hashVersion: number;
	hashParameters: Record<string, number>;
};

const compromisedPasswords = new Set([
	"123456789012",
	"111111111111",
	"administrator",
	"correcthorsebatterystaple",
	"dragon123456",
	"iloveyou1234",
	"letmeinletmein",
	"mothmark1234",
	"passw0rd1234",
	"password1234",
	"passwordpassword",
	"qwertyuiop12",
	"welcome12345",
]);

export class PasswordValidationError extends Error {
	constructor(readonly code: "COMPROMISED" | "TOO_LONG" | "TOO_SHORT") {
		super(
			code === "TOO_SHORT"
				? "Use at least 12 characters."
				: code === "TOO_LONG"
					? "Use no more than 128 characters."
					: "Choose a password that is not commonly compromised.",
		);
	}
}

export function validatePassword(password: string): void {
	const length = [...password].length;
	if (length < 12) throw new PasswordValidationError("TOO_SHORT");
	if (length > 128) throw new PasswordValidationError("TOO_LONG");
	if (compromisedPasswords.has(password.toLowerCase())) {
		throw new PasswordValidationError("COMPROMISED");
	}
}

export async function hashPassword(password: string): Promise<StoredPassword> {
	validatePassword(password);
	return {
		passwordHash: await hash(password, PASSWORD_PARAMETERS),
		hashVersion: PASSWORD_HASH_VERSION,
		hashParameters: {
			algorithm: PASSWORD_ALGORITHM_ARGON2ID,
			memoryCost: PASSWORD_PARAMETERS.memoryCost,
			outputLen: PASSWORD_PARAMETERS.outputLen,
			parallelism: PASSWORD_PARAMETERS.parallelism,
			timeCost: PASSWORD_PARAMETERS.timeCost,
		},
	};
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}

export function passwordNeedsRehash(
	stored: Pick<StoredPassword, "hashParameters" | "hashVersion">,
): boolean {
	return (
		stored.hashVersion !== PASSWORD_HASH_VERSION ||
		stored.hashParameters.algorithm !== PASSWORD_ALGORITHM_ARGON2ID ||
		stored.hashParameters.memoryCost !== PASSWORD_PARAMETERS.memoryCost ||
		stored.hashParameters.outputLen !== PASSWORD_PARAMETERS.outputLen ||
		stored.hashParameters.parallelism !== PASSWORD_PARAMETERS.parallelism ||
		stored.hashParameters.timeCost !== PASSWORD_PARAMETERS.timeCost
	);
}

export async function verifyAndUpgradePassword(
	stored: StoredPassword,
	password: string,
): Promise<{valid: boolean; upgraded?: StoredPassword}> {
	const result = await verifyPassword(stored.passwordHash, password);
	if (!result) return {valid: false};
	return passwordNeedsRehash(stored)
		? {valid: true, upgraded: await hashPassword(password)}
		: {valid: true};
}
