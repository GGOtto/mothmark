import "server-only";

import type {Knex} from "knex";

import {PERSISTED_SCHEMA_VERSION} from "@/compat/migrations";
import {parseStoredWorld} from "@/compat/storageCodec";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {
	EDITOR_SESSION_DURATION_MS,
	createOpaqueToken,
	hashSessionToken,
} from "@/auth/sessionTokens";

import {getDb} from "./knex";
import {
	ensureDefaultUserLimits,
	createOwnedEditorSlug,
	mapWorldRow,
	type WorldRecord,
	type WorldRow,
} from "./worldsRepository";

const database = getDb();
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1_000;

export type SessionAudience = "admin" | "editor" | "play";

export type CurrentActor = {
	userId: string;
	accountType: "anonymous" | "registered";
	siteRole: "admin" | "user";
	audience: SessionAudience;
	cleanupCancelled?: true;
};

export type SessionActorRow = {
	user_id: string;
	account_type: CurrentActor["accountType"];
	site_role: CurrentActor["siteRole"];
	user_status: "active" | "deleted" | "suspended";
	user_deleted_at: Date | string | null;
	audience: SessionAudience;
	session_id: string;
	session_last_seen_at: Date | string;
	expires_at: Date | string;
	revoked_at: Date | string | null;
	cleanup_scheduled_at: Date | string | null;
};

export function activeActorFromSession(
	row: SessionActorRow,
	expectedAudience: SessionAudience,
	now: Date,
): CurrentActor | undefined {
	if (
		row.audience !== expectedAudience ||
		row.revoked_at !== null ||
		new Date(row.expires_at) <= now ||
		row.user_status !== "active" ||
		row.user_deleted_at !== null
	) {
		return undefined;
	}

	return {
		userId: row.user_id,
		accountType: row.account_type,
		siteRole: row.site_role,
		audience: row.audience,
	};
}

async function findSessionActorRow(
	token: string,
	connection: Knex | Knex.Transaction = database,
	lockUser = false,
): Promise<SessionActorRow | undefined> {
	const query = connection("sessions as s")
		.join("users as u", "u.id", "s.user_id")
		.select<SessionActorRow[]>(
			"s.id as session_id",
			"s.user_id",
			"s.audience",
			"s.last_seen_at as session_last_seen_at",
			"s.expires_at",
			"s.revoked_at",
			"u.account_type",
			"u.site_role",
			"u.status as user_status",
			"u.deleted_at as user_deleted_at",
			"u.cleanup_scheduled_at",
		)
		.where("s.token_hash", hashSessionToken(token));
	if (lockUser) query.forUpdate("u");
	return query.first();
}

export type BootstrapEditorActor = CurrentActor | "blocked" | undefined;

export async function findBootstrapEditorActor(token: string): Promise<BootstrapEditorActor> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		const row = await findSessionActorRow(token, transaction, true);
		if (!row) return undefined;
		if (row.user_status === "suspended") return "blocked";
		const actor = activeActorFromSession(row, "editor", now);
		if (!actor) return undefined;
		return refreshActorActivity(transaction, row, actor, now);
	});
}

export async function findBootstrapPlayActor(token: string): Promise<BootstrapEditorActor> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		const row = await findSessionActorRow(token, transaction, true);
		if (!row) return undefined;
		if (row.user_status === "suspended") return "blocked";
		const actor = activeActorFromSession(row, "play", now);
		if (!actor) return undefined;
		return refreshActorActivity(transaction, row, actor, now);
	});
}

export async function findCurrentActor(
	token: string,
	audience: SessionAudience,
): Promise<CurrentActor | undefined> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		const row = await findSessionActorRow(token, transaction, true);
		if (!row) return undefined;
		const actor = activeActorFromSession(row, audience, now);
		if (!actor) return undefined;
		return refreshActorActivity(transaction, row, actor, now);
	});
}

async function refreshActorActivity(
	transaction: Knex.Transaction,
	row: SessionActorRow,
	actor: CurrentActor,
	now: Date,
): Promise<CurrentActor> {
	const sessionSeenIsStale =
		now.getTime() - new Date(row.session_last_seen_at).getTime() >= LAST_SEEN_WRITE_INTERVAL_MS;
	if (sessionSeenIsStale || row.cleanup_scheduled_at) {
		if (sessionSeenIsStale) {
			await transaction("sessions").where({id: row.session_id}).update({last_seen_at: now});
		}
		await transaction("users")
			.where({id: row.user_id})
			.update({
				...(sessionSeenIsStale && {last_seen_at: now}),
				...(row.cleanup_scheduled_at && {cleanup_cancelled_at: now}),
				cleanup_scheduled_at: null,
				cleanup_after: null,
				cleanup_reason: null,
				updated_at: now,
			});
		if (row.cleanup_scheduled_at) {
			await transaction("operational_events").insert({
				event_type: "anonymous_cleanup_cancelled_on_return",
				details: {userId: row.user_id},
			});
		}
	}
	return row.cleanup_scheduled_at ? {...actor, cleanupCancelled: true} : actor;
}

async function ensureFirstOwnedWorld(
	transaction: Knex.Transaction,
	userId: string,
	recordOpened: boolean,
): Promise<WorldRecord> {
	await transaction("users").where({id: userId}).forUpdate().first();
	await ensureDefaultUserLimits(transaction, userId);
	const existing = await transaction<WorldRow>("worlds as w")
		.leftJoin("user_world_activity as a", function () {
			this.on("a.world_id", "=", "w.id").andOn("a.user_id", "=", "w.owner_user_id");
		})
		.select("w.*", "a.last_opened_at")
		.where({"w.owner_user_id": userId, "w.kind": "editor"})
		.whereNull("w.deleted_at")
		.orderByRaw("a.last_opened_at desc nulls last")
		.orderBy("w.updated_at", "desc")
		.first();
	if (existing) {
		if (recordOpened) {
			await transaction("user_world_activity")
				.insert({user_id: userId, world_id: existing.id, last_opened_at: transaction.fn.now()})
				.onConflict(["user_id", "world_id"])
				.merge({last_opened_at: transaction.fn.now()});
		}
		return mapWorldRow({
			...existing,
			last_opened_at: recordOpened ? new Date() : existing.last_opened_at,
		});
	}

	await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", ["mothmark-template-main"]);
	let template = await transaction<WorldRow>("worlds")
		.where({kind: "template", slug: "main"})
		.first();

	if (!template) {
		const [createdTemplate] = await transaction<WorldRow>("worlds")
			.insert({
				name: initialWorld.metadata.title || "Main world",
				slug: "main",
				world: initialWorld,
				schema_version: PERSISTED_SCHEMA_VERSION,
				kind: "template",
				owner_user_id: null,
			})
			.returning("*");
		template = createdTemplate;
	}

	if (!template) throw new Error("The initial world template could not be created.");
	const editorSlug = await createOwnedEditorSlug(transaction, userId, template.name);

	const [world] = await transaction<WorldRow>("worlds")
		.insert({
			editor_slug: editorSlug,
			name: template.name,
			slug: null,
			world: parseStoredWorld(template.world, template.schema_version, {
				id: template.id,
				storage: "template",
			}),
			schema_version: PERSISTED_SCHEMA_VERSION,
			kind: "editor",
			owner_user_id: userId,
			updated_by_user_id: userId,
		})
		.returning("*");

	if (!world) throw new Error("The first editor world could not be created.");
	if (recordOpened) {
		await transaction("user_world_activity").insert({user_id: userId, world_id: world.id});
	}
	return mapWorldRow({...world, last_opened_at: recordOpened ? new Date() : null});
}

export async function getOrCreateFirstOwnedWorld(
	userId: string,
	recordOpened = true,
): Promise<WorldRecord> {
	return database.transaction((transaction) =>
		ensureFirstOwnedWorld(transaction, userId, recordOpened),
	);
}

export async function getRecentOwnedWorld(userId: string): Promise<WorldRecord | undefined> {
	const row = await database<WorldRow>("worlds as w")
		.leftJoin("user_world_activity as a", function () {
			this.on("a.world_id", "=", "w.id").andOn("a.user_id", "=", "w.owner_user_id");
		})
		.select("w.*", "a.last_opened_at")
		.where({"w.owner_user_id": userId, "w.kind": "editor"})
		.whereNull("w.deleted_at")
		.orderByRaw("a.last_opened_at desc nulls last")
		.orderBy("w.updated_at", "desc")
		.first();
	return row ? mapWorldRow(row) : undefined;
}

export type AnonymousEditorBootstrap = {
	userId: string;
	sessionToken: string;
	expiresAt: Date;
	world: WorldRecord;
};

export async function createAnonymousEditorBootstrap(
	recordOpened = true,
): Promise<AnonymousEditorBootstrap> {
	const sessionToken = createOpaqueToken();
	const expiresAt = new Date(Date.now() + EDITOR_SESSION_DURATION_MS);

	return database.transaction(async (transaction) => {
		const [user] = await transaction("users")
			.insert({account_type: "anonymous", site_role: "user", status: "active"})
			.returning<{id: string}[]>("id");
		if (!user) throw new Error("The temporary account could not be created.");

		await transaction("sessions").insert({
			user_id: user.id,
			audience: "editor",
			token_hash: hashSessionToken(sessionToken),
			expires_at: expiresAt,
		});

		const world = await ensureFirstOwnedWorld(transaction, user.id, recordOpened);
		return {userId: user.id, sessionToken, expiresAt, world};
	});
}
