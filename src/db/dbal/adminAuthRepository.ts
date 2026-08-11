import "server-only";

import {createHash, randomBytes} from "node:crypto";
import type {Knex} from "knex";

import {ADMIN_SESSION_DURATION_MS, createOpaqueToken, hashSessionToken} from "@/auth/sessionTokens";
import {hashPassword, verifyAndUpgradePassword, type StoredPassword} from "@/auth/passwords";
import {
	createTotpSecret,
	decryptTotpSecret,
	encryptTotpSecret,
	totpEnrollmentUri,
	verifyTotp,
} from "@/auth/totp";

import {getDb} from "./knex";
import {DEFAULT_MAX_WORLDS} from "./worldsRepository";

const database = getDb();
const ADMIN_MAX_WORLDS = 100;
const ADMIN_CHALLENGE_DURATION_MS = 5 * 60 * 1_000;
const RECOVERY_CODE_COUNT = 10;
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1_000;
const dummyAdministratorPassword = hashPassword("Mothmark administrator timing comparison");

export class AdministratorIdentityError extends Error {
	constructor(
		message: string,
		readonly code: "ADMIN_ALREADY_PROVISIONED" | "ADMIN_IDENTITY_INVALID",
	) {
		super(message);
	}
}

export type AdministratorProvisioning = {
	recoveryCodes: string[];
	totpSecret: string;
	totpUri: string;
	userId: string;
};

export type AdministratorPasswordResult =
	{status: "invalid"} | {status: "second_factor_required"; challengeToken: string; expiresAt: Date};

export type AdministratorSignInResult =
	| {status: "invalid"}
	| {status: "authenticated"; sessionToken: string; expiresAt: Date; userId: string};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const provisionedAdministratorUsername = (normalizedEmail: string) =>
	`admin-${createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 24)}`;
const recoveryCodeHash = (code: string) =>
	createHash("sha256")
		.update(code.replace(/[^a-z0-9]/giu, "").toLowerCase())
		.digest("hex");
const attemptHash = (kind: string, value: string) =>
	createHash("sha256").update(`admin:${kind}:${value}`).digest("hex");

async function allowAdministratorAttempt(
	transaction: Knex.Transaction,
	action: string,
	identifier: string,
	network: string,
	now: Date,
): Promise<boolean> {
	const cutoff = new Date(now.getTime() - ADMIN_AUTH_WINDOW_MS);
	const dimensions = [
		{hash: attemptHash("account", identifier), limit: 5},
		{hash: attemptHash("network", network), limit: 20},
	];
	for (const dimension of [...dimensions].sort((left, right) =>
		left.hash.localeCompare(right.hash),
	)) {
		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			`mothmark-auth-attempt:${action}:${dimension.hash}`,
		]);
	}
	await transaction("authentication_attempts").where("attempted_at", "<", cutoff).delete();
	for (const dimension of dimensions) {
		const count = await transaction("authentication_attempts")
			.where({action, dimension_hash: dimension.hash})
			.where("attempted_at", ">=", cutoff)
			.count<{count: string}[]>("id as count")
			.first();
		if (Number(count?.count ?? 0) >= dimension.limit) return false;
	}
	await transaction("authentication_attempts").insert(
		dimensions.map((dimension) => ({action, attempted_at: now, dimension_hash: dimension.hash})),
	);
	return true;
}

async function clearAdministratorAttempts(
	transaction: Knex.Transaction,
	action: string,
	identifier: string,
	network: string,
): Promise<void> {
	await transaction("authentication_attempts")
		.where({action})
		.whereIn("dimension_hash", [attemptHash("account", identifier), attemptHash("network", network)])
		.delete();
}

function createRecoveryCodes(): string[] {
	return Array.from({length: RECOVERY_CODE_COUNT}, () => {
		const value = randomBytes(10).toString("hex").toUpperCase();
		return `${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10, 15)}-${value.slice(15)}`;
	});
}

const passwordColumns = (password: StoredPassword) => ({
	password_hash: password.passwordHash,
	hash_parameters: password.hashParameters,
	hash_version: password.hashVersion,
});

export async function provisionAdministrator(input: {
	email: string;
	password: string;
	totpCode: string;
	totpSecret: string;
}): Promise<AdministratorProvisioning> {
	const email = input.email.trim();
	const normalizedEmail = normalizeEmail(email);
	const username = provisionedAdministratorUsername(normalizedEmail);
	const password = await hashPassword(input.password);
	const totpSecret = input.totpSecret;
	if (verifyTotp(totpSecret, input.totpCode) === undefined) {
		throw new AdministratorIdentityError(
			"The TOTP confirmation code is invalid.",
			"ADMIN_IDENTITY_INVALID",
		);
	}
	const encryptedSecret = encryptTotpSecret(totpSecret);
	const recoveryCodes = createRecoveryCodes();

	return database.transaction(async (transaction) => {
		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			"mothmark-password-administrator-provisioning",
		]);
		const existingAdministrator = await transaction("users")
			.where({site_role: "admin"})
			.forUpdate()
			.first<{id: string}>();
		const existingEmail = await transaction("user_emails")
			.where({normalized_email: normalizedEmail})
			.forUpdate()
			.first<{user_id: string}>();
		if (existingAdministrator && existingAdministrator.id !== existingEmail?.user_id) {
			throw new AdministratorIdentityError(
				"An administrator is already provisioned for another verified email.",
				"ADMIN_ALREADY_PROVISIONED",
			);
		}

		const now = new Date();
		let userId = existingEmail?.user_id;
		if (userId) {
			const user = await transaction("users").where({id: userId}).forUpdate().first();
			if (!user || user.status !== "active" || user.deleted_at !== null) {
				throw new AdministratorIdentityError(
					"The configured email is not attached to an active account.",
					"ADMIN_IDENTITY_INVALID",
				);
			}
			await transaction("users")
				.where({id: userId})
				.update({
					account_type: "registered",
					registered_at: user.registered_at ?? now,
					site_role: "admin",
					updated_at: now,
					username: user.username ?? username,
				});
			await transaction("password_credentials")
				.insert({...passwordColumns(password), user_id: userId})
				.onConflict("user_id")
				.merge({...passwordColumns(password), authenticated_at: null, updated_at: now});
			await transaction("user_limits")
				.insert({max_worlds: ADMIN_MAX_WORLDS, user_id: userId})
				.onConflict("user_id")
				.merge({max_worlds: ADMIN_MAX_WORLDS, updated_at: now});
		} else {
			const [user] = await transaction("users")
				.insert({
					account_type: "registered",
					display_name: null,
					registered_at: now,
					site_role: "admin",
					status: "active",
					username,
				})
				.returning<{id: string}[]>("id");
			if (!user) throw new Error("The administrator could not be created.");
			userId = user.id;
			await transaction("user_emails").insert({
				email,
				normalized_email: normalizedEmail,
				user_id: userId,
				verified_at: now,
			});
			await transaction("password_credentials").insert({
				...passwordColumns(password),
				user_id: userId,
			});
			await transaction("user_limits").insert({
				max_worlds: Math.max(DEFAULT_MAX_WORLDS, ADMIN_MAX_WORLDS),
				user_id: userId,
			});
		}
		if (!userId) throw new Error("The administrator has no user ID.");
		await transaction("totp_authenticators").where({user_id: userId}).delete();
		await transaction("administrator_recovery_codes").where({user_id: userId}).delete();
		await transaction("totp_authenticators").insert({
			confirmed_at: now,
			encrypted_secret: encryptedSecret,
			user_id: userId,
		});
		await transaction("administrator_recovery_codes").insert(
			recoveryCodes.map((code) => ({code_hash: recoveryCodeHash(code), user_id: userId})),
		);
		await transaction("sessions")
			.where({user_id: userId})
			.whereNull("revoked_at")
			.update({revoked_at: now});
		await transaction("operational_events").insert({
			details: {userId},
			event_type: "administrator_provisioned",
		});
		return {recoveryCodes, totpSecret, totpUri: totpEnrollmentUri(email, totpSecret), userId};
	});
}

export async function beginAdministratorSignIn(input: {
	email: string;
	network: string;
	password: string;
}): Promise<AdministratorPasswordResult> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		if (
			!(await allowAdministratorAttempt(
				transaction,
				"admin_password",
				normalizeEmail(input.email),
				input.network,
				now,
			))
		) {
			return {status: "invalid"};
		}
		const identity = await transaction("user_emails as e")
			.join("users as u", "u.id", "e.user_id")
			.join("password_credentials as p", "p.user_id", "u.id")
			.join("totp_authenticators as a", "a.user_id", "u.id")
			.select(
				"u.id as user_id",
				"u.status",
				"u.deleted_at",
				"p.password_hash",
				"p.hash_version",
				"p.hash_parameters",
			)
			.where({
				"e.normalized_email": normalizeEmail(input.email),
				"u.account_type": "registered",
				"u.site_role": "admin",
			})
			.whereNotNull("e.verified_at")
			.first<{
				user_id: string;
				status: string;
				deleted_at: Date | null;
				password_hash: string;
				hash_version: number;
				hash_parameters: Record<string, number>;
			}>();
		const result = await verifyAndUpgradePassword(
			identity
				? {
						passwordHash: identity.password_hash,
						hashParameters: identity.hash_parameters,
						hashVersion: identity.hash_version,
					}
				: await dummyAdministratorPassword,
			input.password,
		);
		if (!identity || identity.status !== "active" || identity.deleted_at !== null || !result.valid) {
			return {status: "invalid"};
		}
		if (result.upgraded) {
			await transaction("password_credentials")
				.where({user_id: identity.user_id})
				.update({...passwordColumns(result.upgraded), updated_at: transaction.fn.now()});
		}
		const challengeToken = createOpaqueToken();
		const expiresAt = new Date(Date.now() + ADMIN_CHALLENGE_DURATION_MS);
		await transaction("account_tokens")
			.where({purpose: "admin_sign_in", user_id: identity.user_id})
			.whereNull("consumed_at")
			.whereNull("superseded_at")
			.update({superseded_at: transaction.fn.now()});
		await transaction("account_tokens").insert({
			expires_at: expiresAt,
			purpose: "admin_sign_in",
			token_hash: hashSessionToken(challengeToken),
			user_id: identity.user_id,
		});
		await clearAdministratorAttempts(
			transaction,
			"admin_password",
			normalizeEmail(input.email),
			input.network,
		);
		return {status: "second_factor_required", challengeToken, expiresAt};
	});
}

export async function completeAdministratorSignIn(input: {
	challengeToken: string;
	secondFactor: string;
	network: string;
	now?: Date;
}): Promise<AdministratorSignInResult> {
	return database.transaction(async (transaction) => {
		const now = input.now ?? new Date();
		const challenge = await transaction("account_tokens as t")
			.join("users as u", "u.id", "t.user_id")
			.join("totp_authenticators as a", "a.user_id", "u.id")
			.select(
				"t.id as token_id",
				"t.user_id",
				"t.expires_at",
				"t.consumed_at",
				"t.superseded_at",
				"u.status",
				"u.deleted_at",
				"u.site_role",
				"a.id as authenticator_id",
				"a.encrypted_secret",
				"a.last_used_counter",
			)
			.where({"t.purpose": "admin_sign_in", "t.token_hash": hashSessionToken(input.challengeToken)})
			.forUpdate("t")
			.first<{
				token_id: string;
				user_id: string;
				expires_at: Date | string;
				consumed_at: Date | null;
				superseded_at: Date | null;
				status: string;
				deleted_at: Date | null;
				site_role: string;
				authenticator_id: string;
				encrypted_secret: string;
				last_used_counter: string | number | null;
			}>();
		if (
			!challenge ||
			challenge.consumed_at ||
			challenge.superseded_at ||
			new Date(challenge.expires_at) <= now ||
			challenge.status !== "active" ||
			challenge.deleted_at !== null ||
			challenge.site_role !== "admin"
		) {
			return {status: "invalid"};
		}
		if (
			!(await allowAdministratorAttempt(
				transaction,
				"admin_second_factor",
				challenge.user_id,
				input.network,
				now,
			))
		) {
			return {status: "invalid"};
		}

		let factorKind: "recovery" | "totp" | undefined;
		let counter: number | undefined;
		try {
			counter = verifyTotp(decryptTotpSecret(challenge.encrypted_secret), input.secondFactor, {
				lastUsedCounter:
					challenge.last_used_counter === null ? null : Number(challenge.last_used_counter),
				now,
			});
			if (counter !== undefined) factorKind = "totp";
		} catch {
			return {status: "invalid"};
		}
		if (!factorKind) {
			const [recovery] = await transaction("administrator_recovery_codes")
				.where({user_id: challenge.user_id, code_hash: recoveryCodeHash(input.secondFactor)})
				.whereNull("used_at")
				.forUpdate()
				.limit(1);
			if (recovery) {
				factorKind = "recovery";
				await transaction("administrator_recovery_codes")
					.where({id: recovery.id})
					.update({used_at: now});
			}
		}
		if (!factorKind) return {status: "invalid"};
		if (counter !== undefined) {
			await transaction("totp_authenticators")
				.where({id: challenge.authenticator_id})
				.update({last_used_counter: counter});
		}
		await transaction("account_tokens").where({id: challenge.token_id}).update({consumed_at: now});
		const sessionToken = createOpaqueToken();
		const expiresAt = new Date(now.getTime() + ADMIN_SESSION_DURATION_MS);
		await transaction("sessions").insert({
			audience: "admin",
			expires_at: expiresAt,
			token_hash: hashSessionToken(sessionToken),
			user_id: challenge.user_id,
		});
		await transaction("password_credentials")
			.where({user_id: challenge.user_id})
			.update({authenticated_at: now});
		await transaction("operational_events").insert({
			details: {factorKind, userId: challenge.user_id},
			event_type: "administrator_signed_in",
		});
		await clearAdministratorAttempts(
			transaction,
			"admin_second_factor",
			challenge.user_id,
			input.network,
		);
		return {status: "authenticated", expiresAt, sessionToken, userId: challenge.user_id};
	});
}

export async function revokeAdministratorSession(token: string): Promise<boolean> {
	return database.transaction(async (transaction) => {
		const [session] = await transaction("sessions")
			.where({audience: "admin", token_hash: hashSessionToken(token)})
			.whereNull("revoked_at")
			.update({revoked_at: transaction.fn.now()})
			.returning<{id: string; user_id: string}[]>(["id", "user_id"]);
		if (!session) return false;
		await transaction("operational_events").insert({
			details: {sessionId: session.id, userId: session.user_id},
			event_type: "administrator_signed_out",
		});
		return true;
	});
}

export async function recoverAdministrator(input: {
	password?: string;
	resetMfa: boolean;
}): Promise<AdministratorProvisioning | {userId: string}> {
	const nextPassword = input.password ? await hashPassword(input.password) : undefined;
	const totpSecret = input.resetMfa ? createTotpSecret() : undefined;
	const recoveryCodes = input.resetMfa ? createRecoveryCodes() : undefined;
	return database.transaction(async (transaction) => {
		const admin = await transaction("users as u")
			.join("user_emails as e", "e.user_id", "u.id")
			.select("u.id", "e.email")
			.where({"u.site_role": "admin", "u.account_type": "registered", "u.status": "active"})
			.forUpdate("u")
			.first<{id: string; email: string}>();
		if (!admin)
			throw new AdministratorIdentityError(
				"No active administrator exists.",
				"ADMIN_IDENTITY_INVALID",
			);
		const now = new Date();
		if (nextPassword) {
			await transaction("password_credentials")
				.where({user_id: admin.id})
				.update({...passwordColumns(nextPassword), authenticated_at: null, updated_at: now});
		}
		if (totpSecret && recoveryCodes) {
			await transaction("totp_authenticators").where({user_id: admin.id}).delete();
			await transaction("administrator_recovery_codes").where({user_id: admin.id}).delete();
			await transaction("totp_authenticators").insert({
				confirmed_at: now,
				encrypted_secret: encryptTotpSecret(totpSecret),
				user_id: admin.id,
			});
			await transaction("administrator_recovery_codes").insert(
				recoveryCodes.map((code) => ({code_hash: recoveryCodeHash(code), user_id: admin.id})),
			);
		}
		await transaction("sessions")
			.where({user_id: admin.id})
			.whereNull("revoked_at")
			.update({revoked_at: now});
		await transaction("operational_events").insert({
			details: {passwordReset: Boolean(nextPassword), totpReset: input.resetMfa, userId: admin.id},
			event_type: "administrator_recovered",
		});
		if (totpSecret && recoveryCodes) {
			return {
				recoveryCodes,
				totpSecret,
				totpUri: totpEnrollmentUri(admin.email, totpSecret),
				userId: admin.id,
			};
		}
		return {userId: admin.id};
	});
}

export async function replaceAdministrator(input: {
	email: string;
	totpCode: string;
	totpSecret: string;
}): Promise<AdministratorProvisioning> {
	if (verifyTotp(input.totpSecret, input.totpCode) === undefined) {
		throw new AdministratorIdentityError(
			"The TOTP confirmation code is invalid.",
			"ADMIN_IDENTITY_INVALID",
		);
	}
	const recoveryCodes = createRecoveryCodes();
	return database.transaction(async (transaction) => {
		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			"mothmark-password-administrator-provisioning",
		]);
		const current = await transaction("users")
			.where({account_type: "registered", site_role: "admin", status: "active"})
			.forUpdate()
			.first<{id: string}>();
		const replacement = await transaction("user_emails as e")
			.join("users as u", "u.id", "e.user_id")
			.select("u.id", "e.email")
			.where({
				"e.normalized_email": normalizeEmail(input.email),
				"u.account_type": "registered",
				"u.site_role": "user",
				"u.status": "active",
			})
			.whereNotNull("e.verified_at")
			.whereNull("u.deleted_at")
			.forUpdate("u")
			.first<{email: string; id: string}>();
		if (!current || !replacement) {
			throw new AdministratorIdentityError(
				"The replacement must be a different active account with a verified email.",
				"ADMIN_IDENTITY_INVALID",
			);
		}
		const now = new Date();
		await transaction("users").where({id: current.id}).update({site_role: "user", updated_at: now});
		await transaction("users")
			.where({id: replacement.id})
			.update({site_role: "admin", updated_at: now});
		await transaction("totp_authenticators")
			.whereIn("user_id", [current.id, replacement.id])
			.delete();
		await transaction("administrator_recovery_codes")
			.whereIn("user_id", [current.id, replacement.id])
			.delete();
		await transaction("totp_authenticators").insert({
			confirmed_at: now,
			encrypted_secret: encryptTotpSecret(input.totpSecret),
			user_id: replacement.id,
		});
		await transaction("administrator_recovery_codes").insert(
			recoveryCodes.map((code) => ({code_hash: recoveryCodeHash(code), user_id: replacement.id})),
		);
		await transaction("user_limits")
			.where({user_id: replacement.id})
			.update({max_worlds: ADMIN_MAX_WORLDS, updated_at: now});
		await transaction("sessions")
			.whereIn("user_id", [current.id, replacement.id])
			.whereNull("revoked_at")
			.update({revoked_at: now});
		await transaction("operational_events").insert({
			details: {previousUserId: current.id, replacementUserId: replacement.id},
			event_type: "administrator_replaced",
		});
		return {
			recoveryCodes,
			totpSecret: input.totpSecret,
			totpUri: totpEnrollmentUri(replacement.email, input.totpSecret),
			userId: replacement.id,
		};
	});
}
