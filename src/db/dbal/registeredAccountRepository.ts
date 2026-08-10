import "server-only";

import {createHash} from "node:crypto";

import type {Knex} from "knex";

import {
	hashPassword,
	verifyAndUpgradePassword,
	verifyPassword,
	type StoredPassword,
} from "@/auth/passwords";
import {
	EDITOR_SESSION_DURATION_MS,
	createOpaqueToken,
	hashSessionToken,
} from "@/auth/sessionTokens";
import {normalizeUsername} from "@/auth/usernames";

import {getDb} from "./knex";
import {DEFAULT_MAX_WORLDS} from "./worldsRepository";

const database = getDb();
const VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1_000;
const RESET_DURATION_MS = 60 * 60 * 1_000;
const AUTH_WINDOW_MS = 15 * 60 * 1_000;
const IDENTIFIER_ATTEMPT_LIMIT = 5;
const NETWORK_ATTEMPT_LIMIT = 20;
const dummyPassword = hashPassword("Mothmark timing comparison only 2026");

type PasswordCredentialRow = {
	user_id: string;
	password_hash: string;
	hash_version: number;
	hash_parameters: Record<string, number>;
};

type RegisteredIdentityRow = PasswordCredentialRow & {
	account_type: "anonymous" | "registered";
	email: string;
	normalized_email: string;
	site_role: "admin" | "user";
	status: "active" | "deleted" | "suspended";
	deleted_at: Date | string | null;
};

export type EmailDispatch = {email: string; token: string};

export class UsernameUnavailableError extends Error {
	constructor() {
		super("That username is already in use.");
		this.name = "UsernameUnavailableError";
	}
}

export type EditorSignIn = {
	expiresAt: Date;
	sessionToken: string;
	userId: string;
};

export type RegistrationCompletion =
	| {status: "expired"}
	| {status: "verified"; upgradedAnonymous: boolean; signIn: EditorSignIn; userId: string};

export type AuthenticationResult =
	| {status: "invalid" | "throttled"}
	| {status: "authenticated"; signIn: EditorSignIn; siteRole: "admin" | "user"};

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

const storedPassword = (row: PasswordCredentialRow): StoredPassword => ({
	passwordHash: row.password_hash,
	hashParameters: row.hash_parameters,
	hashVersion: row.hash_version,
});

const passwordColumns = (password: StoredPassword) => ({
	password_hash: password.passwordHash,
	hash_parameters: password.hashParameters,
	hash_version: password.hashVersion,
});

async function createEditorSession(
	transaction: Knex.Transaction,
	userId: string,
	now: Date,
): Promise<EditorSignIn> {
	const sessionToken = createOpaqueToken();
	const expiresAt = new Date(now.getTime() + EDITOR_SESSION_DURATION_MS);
	await transaction("sessions").insert({
		audience: "editor",
		expires_at: expiresAt,
		token_hash: hashSessionToken(sessionToken),
		user_id: userId,
	});
	return {expiresAt, sessionToken, userId};
}

const dimensionHash = (kind: "identifier" | "network", value: string) =>
	createHash("sha256").update(`${kind}:${value}`).digest("hex");

async function recordAuthenticationAttempt(
	transaction: Knex.Transaction,
	action: string,
	email: string,
	network: string,
	now: Date,
): Promise<boolean> {
	const cutoff = new Date(now.getTime() - AUTH_WINDOW_MS);
	const dimensions = [
		{hash: dimensionHash("identifier", normalizeEmail(email)), limit: IDENTIFIER_ATTEMPT_LIMIT},
		{hash: dimensionHash("network", network), limit: NETWORK_ATTEMPT_LIMIT},
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
		dimensions.map((dimension) => ({
			action,
			attempted_at: now,
			dimension_hash: dimension.hash,
		})),
	);
	return true;
}

async function clearAuthenticationAttempts(
	transaction: Knex.Transaction,
	action: string,
	email: string,
	network: string,
): Promise<void> {
	await transaction("authentication_attempts")
		.where({action})
		.whereIn("dimension_hash", [
			dimensionHash("identifier", normalizeEmail(email)),
			dimensionHash("network", network),
		])
		.delete();
}

async function findRegisteredIdentity(
	connection: Knex | Knex.Transaction,
	email: string,
): Promise<RegisteredIdentityRow | undefined> {
	return connection("user_emails as e")
		.join("users as u", "u.id", "e.user_id")
		.join("password_credentials as p", "p.user_id", "u.id")
		.select<RegisteredIdentityRow[]>(
			"p.user_id",
			"p.password_hash",
			"p.hash_version",
			"p.hash_parameters",
			"e.email",
			"e.normalized_email",
			"u.account_type",
			"u.site_role",
			"u.status",
			"u.deleted_at",
		)
		.where("e.normalized_email", normalizeEmail(email))
		.whereNotNull("e.verified_at")
		.first();
}

async function createAccountToken(
	transaction: Knex.Transaction,
	input: {
		purpose: "admin_sign_in" | "password_reset" | "verify_email";
		registrationId?: string;
		userId?: string;
		durationMs: number;
	},
): Promise<{expiresAt: Date; token: string}> {
	const token = createOpaqueToken();
	const expiresAt = new Date(Date.now() + input.durationMs);
	const target = input.userId ? {user_id: input.userId} : {registration_id: input.registrationId};
	await transaction("account_tokens")
		.where({...target, purpose: input.purpose})
		.whereNull("consumed_at")
		.whereNull("superseded_at")
		.update({superseded_at: transaction.fn.now()});
	await transaction("account_tokens").insert({
		...target,
		expires_at: expiresAt,
		purpose: input.purpose,
		token_hash: hashSessionToken(token),
	});
	return {expiresAt, token};
}

export async function beginRegistration(input: {
	email: string;
	network: string;
	password: string;
	username: string;
	userId?: string;
}): Promise<EmailDispatch | undefined> {
	const email = input.email.trim();
	const normalizedEmail = normalizeEmail(email);
	const username = input.username.trim();
	const normalizedUsername = normalizeUsername(username);
	const password = await hashPassword(input.password);
	return database.transaction(async (transaction) => {
		if (
			!(await recordAuthenticationAttempt(transaction, "register", email, input.network, new Date()))
		) {
			return undefined;
		}
		for (const lock of [
			`mothmark-registration-email:${normalizedEmail}`,
			`mothmark-registration-username:${normalizedUsername}`,
		].sort()) {
			await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [lock]);
		}
		if (input.userId) {
			const user = await transaction("users")
				.where({id: input.userId, account_type: "anonymous", site_role: "user", status: "active"})
				.whereNull("deleted_at")
				.forUpdate()
				.first();
			if (!user) return undefined;
		}
		const existingEmail = await transaction("user_emails")
			.where({normalized_email: normalizedEmail})
			.first();
		if (existingEmail) return undefined;

		await transaction("account_registrations")
			.where({normalized_email: normalizedEmail})
			.whereNull("completed_at")
			.whereNull("superseded_at")
			.update({superseded_at: transaction.fn.now()});
		if (input.userId) {
			await transaction("account_registrations")
				.where({user_id: input.userId})
				.whereNull("completed_at")
				.whereNull("superseded_at")
				.update({superseded_at: transaction.fn.now()});
		}
		await transaction("account_registrations")
			.whereRaw("lower(username) = ?", [normalizedUsername])
			.whereNull("completed_at")
			.whereNull("superseded_at")
			.where("expires_at", "<=", transaction.fn.now())
			.update({superseded_at: transaction.fn.now()});
		const [registeredUsername, pendingUsername] = await Promise.all([
			transaction("users").whereRaw("lower(username) = ?", [normalizedUsername]).first("id"),
			transaction("account_registrations")
				.whereRaw("lower(username) = ?", [normalizedUsername])
				.whereNull("completed_at")
				.whereNull("superseded_at")
				.where("expires_at", ">", transaction.fn.now())
				.first("id"),
		]);
		if (registeredUsername || pendingUsername) throw new UsernameUnavailableError();
		const [registration] = await transaction("account_registrations")
			.insert({
				...passwordColumns(password),
				email,
				expires_at: new Date(Date.now() + VERIFICATION_DURATION_MS),
				normalized_email: normalizedEmail,
				username,
				user_id: input.userId ?? null,
			})
			.returning<{id: string}[]>("id");
		if (!registration) throw new Error("The registration could not be created.");
		const token = await createAccountToken(transaction, {
			durationMs: VERIFICATION_DURATION_MS,
			purpose: "verify_email",
			registrationId: registration.id,
		});
		return {email, token: token.token};
	});
}

export async function isUsernameAvailable(value: string): Promise<boolean> {
	const username = normalizeUsername(value);
	const [registeredUsername, pendingUsername] = await Promise.all([
		database("users").whereRaw("lower(username) = ?", [username]).first("id"),
		database("account_registrations")
			.whereRaw("lower(username) = ?", [username])
			.whereNull("completed_at")
			.whereNull("superseded_at")
			.where("expires_at", ">", database.fn.now())
			.first("id"),
	]);
	return !registeredUsername && !pendingUsername;
}

export async function resendVerification(
	email: string,
	network: string,
): Promise<EmailDispatch | undefined> {
	return database.transaction(async (transaction) => {
		if (
			!(await recordAuthenticationAttempt(
				transaction,
				"resend_verification",
				email,
				network,
				new Date(),
			))
		) {
			return undefined;
		}
		const registration = await transaction("account_registrations")
			.where({normalized_email: normalizeEmail(email)})
			.whereNull("completed_at")
			.whereNull("superseded_at")
			.where("expires_at", ">", transaction.fn.now())
			.orderBy("created_at", "desc")
			.forUpdate()
			.first<{id: string; email: string}>();
		if (!registration) return undefined;
		await transaction("account_registrations")
			.where({id: registration.id})
			.update({expires_at: new Date(Date.now() + VERIFICATION_DURATION_MS)});
		const token = await createAccountToken(transaction, {
			durationMs: VERIFICATION_DURATION_MS,
			purpose: "verify_email",
			registrationId: registration.id,
		});
		return {email: registration.email, token: token.token};
	});
}

export async function completeRegistration(
	token: string,
	now = new Date(),
	network = "unavailable",
): Promise<RegistrationCompletion> {
	return database.transaction(async (transaction) => {
		if (!(await recordAuthenticationAttempt(transaction, "verify_email", token, network, now))) {
			return {status: "expired"};
		}
		const row = await transaction("account_tokens as t")
			.join("account_registrations as r", "r.id", "t.registration_id")
			.select(
				"t.id as token_id",
				"t.expires_at as token_expires_at",
				"t.consumed_at",
				"t.superseded_at as token_superseded_at",
				"r.*",
			)
			.where({"t.purpose": "verify_email", "t.token_hash": hashSessionToken(token)})
			.forUpdate("t")
			.first<{
				id: string;
				token_id: string;
				token_expires_at: Date | string;
				consumed_at: Date | null;
				token_superseded_at: Date | null;
				completed_at: Date | null;
				superseded_at: Date | null;
				expires_at: Date | string;
				user_id: string | null;
				email: string;
				normalized_email: string;
				password_hash: string;
				hash_version: number;
				hash_parameters: Record<string, number>;
				username: string;
			}>();
		if (
			!row ||
			row.consumed_at ||
			row.token_superseded_at ||
			row.completed_at ||
			row.superseded_at ||
			new Date(row.token_expires_at) <= now ||
			new Date(row.expires_at) <= now
		) {
			return {status: "expired"};
		}
		for (const lock of [
			`mothmark-registration-email:${row.normalized_email}`,
			`mothmark-registration-username:${normalizeUsername(row.username)}`,
		].sort()) {
			await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [lock]);
		}
		if (await transaction("user_emails").where({normalized_email: row.normalized_email}).first()) {
			await transaction("account_tokens").where({id: row.token_id}).update({consumed_at: now});
			return {status: "expired"};
		}

		let userId = row.user_id;
		const upgradedAnonymous = Boolean(userId);
		if (userId) {
			const user = await transaction("users")
				.where({id: userId, account_type: "anonymous", site_role: "user", status: "active"})
				.whereNull("deleted_at")
				.forUpdate()
				.first();
			if (!user) return {status: "expired"};
			await transaction("users").where({id: userId}).update({
				account_type: "registered",
				cleanup_after: null,
				cleanup_reason: null,
				cleanup_scheduled_at: null,
				display_name: row.email,
				registered_at: now,
				username: row.username,
				updated_at: now,
			});
		} else {
			const [user] = await transaction("users")
				.insert({
					account_type: "registered",
					display_name: row.email,
					registered_at: now,
					site_role: "user",
					status: "active",
					username: row.username,
				})
				.returning<{id: string}[]>("id");
			if (!user) throw new Error("The registered account could not be created.");
			userId = user.id;
			await transaction("user_limits").insert({user_id: userId, max_worlds: DEFAULT_MAX_WORLDS});
		}
		if (!userId) throw new Error("The registered account has no user ID.");
		await transaction("user_emails").insert({
			email: row.email,
			normalized_email: row.normalized_email,
			user_id: userId,
			verified_at: now,
		});
		await transaction("password_credentials").insert({
			...passwordColumns({
				hashParameters: row.hash_parameters,
				hashVersion: row.hash_version,
				passwordHash: row.password_hash,
			}),
			user_id: userId,
		});
		await transaction("account_tokens").where({id: row.token_id}).update({consumed_at: now});
		await transaction("account_registrations").where({id: row.id}).update({completed_at: now});
		await transaction("operational_events").insert({
			details: {upgradedAnonymous, userId},
			event_type: "account_email_verified",
		});
		const signIn = await createEditorSession(transaction, userId, now);
		await clearAuthenticationAttempts(transaction, "verify_email", token, network);
		return {status: "verified", upgradedAnonymous, signIn, userId};
	});
}

export async function authenticateEditor(input: {
	email: string;
	network: string;
	password: string;
}): Promise<AuthenticationResult> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		if (
			!(await recordAuthenticationAttempt(transaction, "sign_in", input.email, input.network, now))
		) {
			return {status: "throttled"};
		}
		const identity = await findRegisteredIdentity(transaction, input.email);
		const comparison = identity ? storedPassword(identity) : await dummyPassword;
		const password = await verifyAndUpgradePassword(comparison, input.password);
		if (
			!identity ||
			!password.valid ||
			identity.account_type !== "registered" ||
			identity.status !== "active" ||
			identity.deleted_at !== null
		) {
			return {status: "invalid"};
		}
		if (password.upgraded) {
			await transaction("password_credentials")
				.where({user_id: identity.user_id})
				.update({...passwordColumns(password.upgraded), updated_at: now});
		}
		await transaction("password_credentials")
			.where({user_id: identity.user_id})
			.update({authenticated_at: now});
		const signIn = await createEditorSession(transaction, identity.user_id, now);
		await clearAuthenticationAttempts(transaction, "sign_in", input.email, input.network);
		return {
			status: "authenticated",
			signIn,
			siteRole: identity.site_role,
		};
	});
}

export async function beginPasswordReset(input: {
	email: string;
	network: string;
}): Promise<{dispatch?: EmailDispatch; throttled: boolean}> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		if (
			!(await recordAuthenticationAttempt(
				transaction,
				"password_reset",
				input.email,
				input.network,
				now,
			))
		) {
			return {throttled: true};
		}
		const identity = await findRegisteredIdentity(transaction, input.email);
		if (!identity || identity.status !== "active" || identity.deleted_at !== null) {
			return {throttled: false};
		}
		const reset = await createAccountToken(transaction, {
			durationMs: RESET_DURATION_MS,
			purpose: "password_reset",
			userId: identity.user_id,
		});
		return {dispatch: {email: identity.email, token: reset.token}, throttled: false};
	});
}

export async function resetPassword(
	token: string,
	password: string,
	now = new Date(),
): Promise<boolean> {
	const nextPassword = await hashPassword(password);
	return database.transaction(async (transaction) => {
		const reset = await transaction("account_tokens")
			.where({purpose: "password_reset", token_hash: hashSessionToken(token)})
			.forUpdate()
			.first<{
				id: string;
				user_id: string;
				expires_at: Date | string;
				consumed_at: Date | null;
				superseded_at: Date | null;
			}>();
		if (!reset || reset.consumed_at || reset.superseded_at || new Date(reset.expires_at) <= now) {
			return false;
		}
		await transaction("password_credentials")
			.where({user_id: reset.user_id})
			.update({...passwordColumns(nextPassword), authenticated_at: null, updated_at: now});
		await transaction("account_tokens").where({id: reset.id}).update({consumed_at: now});
		await transaction("sessions")
			.where({user_id: reset.user_id})
			.whereNull("revoked_at")
			.update({revoked_at: now});
		await transaction("operational_events").insert({
			details: {userId: reset.user_id},
			event_type: "account_password_reset",
		});
		return true;
	});
}

export async function changePassword(input: {
	currentPassword: string;
	newPassword: string;
	userId: string;
}): Promise<boolean> {
	const nextPassword = await hashPassword(input.newPassword);
	return database.transaction(async (transaction) => {
		const credential = await transaction<PasswordCredentialRow>("password_credentials")
			.where({user_id: input.userId})
			.forUpdate()
			.first();
		if (!credential || !(await verifyPassword(credential.password_hash, input.currentPassword)))
			return false;
		const now = new Date();
		await transaction("password_credentials")
			.where({user_id: input.userId})
			.update({...passwordColumns(nextPassword), authenticated_at: null, updated_at: now});
		await transaction("sessions")
			.where({user_id: input.userId})
			.whereNull("revoked_at")
			.update({revoked_at: now});
		await transaction("operational_events").insert({
			details: {userId: input.userId},
			event_type: "account_password_changed",
		});
		return true;
	});
}

export async function revokeEditorSession(token: string): Promise<boolean> {
	return (
		(await database("sessions")
			.where({audience: "editor", token_hash: hashSessionToken(token)})
			.whereNull("revoked_at")
			.update({revoked_at: database.fn.now()})) > 0
	);
}

export async function registeredEmailForUser(userId: string): Promise<string | undefined> {
	return (
		await database("user_emails").select<{email: string}[]>("email").where({user_id: userId}).first()
	)?.email;
}

export async function listActiveEditorSessions(
	userId: string,
): Promise<Array<{createdAt: string; expiresAt: string; id: string; lastSeenAt: string}>> {
	const rows = await database("sessions")
		.where({audience: "editor", user_id: userId})
		.whereNull("revoked_at")
		.where("expires_at", ">", database.fn.now())
		.orderBy("last_seen_at", "desc");
	return rows.map((row) => ({
		createdAt: new Date(row.created_at).toISOString(),
		expiresAt: new Date(row.expires_at).toISOString(),
		id: row.id,
		lastSeenAt: new Date(row.last_seen_at).toISOString(),
	}));
}

export async function deleteRegisteredAccount(input: {
	password: string;
	secondFactor?: string;
	userId: string;
}): Promise<"deleted" | "invalid_credentials" | "sole_administrator"> {
	return database.transaction(async (transaction) => {
		const identity = await transaction("users as u")
			.join("password_credentials as p", "p.user_id", "u.id")
			.select("u.site_role", "p.password_hash")
			.where({"u.account_type": "registered", "u.id": input.userId, "u.status": "active"})
			.forUpdate("u")
			.first<{password_hash: string; site_role: "admin" | "user"}>();
		if (!identity || !(await verifyPassword(identity.password_hash, input.password))) {
			return "invalid_credentials";
		}
		if (identity.site_role === "admin") return "sole_administrator";
		await transaction("sessions")
			.where({user_id: input.userId})
			.whereNull("revoked_at")
			.update({revoked_at: transaction.fn.now()});
		await transaction("users").where({id: input.userId}).delete();
		return "deleted";
	});
}
