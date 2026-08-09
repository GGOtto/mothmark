import "server-only";

import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;

function base32Encode(value: Buffer): string {
	let bits = 0;
	let buffer = 0;
	let output = "";
	for (const byte of value) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
	return output;
}

function base32Decode(value: string): Buffer {
	let bits = 0;
	let buffer = 0;
	const bytes: number[] = [];
	for (const character of value.toUpperCase().replace(/=+$/u, "")) {
		const index = BASE32_ALPHABET.indexOf(character);
		if (index < 0) throw new Error("The TOTP secret is invalid.");
		buffer = (buffer << 5) | index;
		bits += 5;
		if (bits >= 8) {
			bytes.push((buffer >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(bytes);
}

function credentialKey(encoded = process.env.CREDENTIAL_ENCRYPTION_KEY): Buffer {
	if (!encoded) throw new Error("CREDENTIAL_ENCRYPTION_KEY is required.");
	const key = Buffer.from(encoded, "base64");
	if (key.length !== 32)
		throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 32 base64-encoded bytes.");
	return key;
}

export function createTotpSecret(): string {
	return base32Encode(randomBytes(20));
}

export function encryptTotpSecret(secret: string, encodedKey?: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", credentialKey(encodedKey), iv);
	const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
	return [
		"v1",
		iv.toString("base64url"),
		cipher.getAuthTag().toString("base64url"),
		encrypted.toString("base64url"),
	].join(".");
}

export function decryptTotpSecret(value: string, encodedKey?: string): string {
	const [version, ivValue, tagValue, encryptedValue] = value.split(".");
	if (version !== "v1" || !ivValue || !tagValue || !encryptedValue)
		throw new Error("The encrypted TOTP secret is invalid.");
	const decipher = createDecipheriv(
		"aes-256-gcm",
		credentialKey(encodedKey),
		Buffer.from(ivValue, "base64url"),
	);
	decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
	return Buffer.concat([
		decipher.update(Buffer.from(encryptedValue, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

export function totpCode(secret: string, counter: number): string {
	const message = Buffer.alloc(8);
	message.writeBigUInt64BE(BigInt(counter));
	const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
	const offset = (digest.at(-1) ?? 0) & 0x0f;
	const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return binary.toString().padStart(6, "0");
}

export function verifyTotp(
	secret: string,
	code: string,
	options: {lastUsedCounter?: number | null; now?: Date} = {},
): number | undefined {
	if (!/^\d{6}$/u.test(code)) return undefined;
	const counter = Math.floor((options.now ?? new Date()).getTime() / 1_000 / TOTP_STEP_SECONDS);
	for (const candidate of [counter - 1, counter, counter + 1]) {
		if (options.lastUsedCounter != null && candidate <= options.lastUsedCounter) continue;
		const expected = Buffer.from(totpCode(secret, candidate));
		const provided = Buffer.from(code);
		if (expected.length === provided.length && timingSafeEqual(expected, provided)) return candidate;
	}
	return undefined;
}

export function totpEnrollmentUri(email: string, secret: string): string {
	const label = encodeURIComponent(`Mothmark:${email}`);
	return `otpauth://totp/${label}?secret=${secret}&issuer=Mothmark&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}
