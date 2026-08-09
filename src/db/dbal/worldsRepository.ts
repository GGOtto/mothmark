import "server-only";

import {produce} from "immer";
import type {Knex} from "knex";

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {createUniqueWorldSlug} from "@/utils/worldSlug";

import {getDb} from "./knex";

const database = getDb();

export const DEFAULT_MAX_WORLDS = 5;
export const TRASH_RECOVERY_MS = 30 * 24 * 60 * 60 * 1_000;

export type WorldKind = "editor" | "template";

export type WorldRecord = {
	id: string;
	name: string;
	slug: string | null;
	world: World;
	revision: number;
	schemaVersion: number;
	ownerUserId: string | null;
	kind: WorldKind;
	updatedByUserId: string | null;
	deletedAt: Date | null;
	editorSlug: string | null;
	trashPurgeAfter: Date | null;
	createdAt: Date;
	updatedAt: Date;
	lastOpenedAt: Date | null;
};

export type WorldRow = {
	id: string;
	name: string;
	slug: string | null;
	world: World;
	revision: number;
	schema_version: number;
	owner_user_id: string | null;
	kind: WorldKind;
	updated_by_user_id: string | null;
	deleted_at: Date | string | null;
	editor_slug: string | null;
	trash_purge_after?: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
	last_opened_at?: Date | string | null;
};

export type UpdateWorldInput = {
	name?: string;
	world?: World;
};

export function mapWorldRow(row: WorldRow): WorldRecord {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		world: row.world,
		revision: row.revision,
		schemaVersion: row.schema_version,
		ownerUserId: row.owner_user_id,
		kind: row.kind,
		updatedByUserId: row.updated_by_user_id,
		deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
		editorSlug: row.editor_slug ?? null,
		trashPurgeAfter: row.trash_purge_after ? new Date(row.trash_purge_after) : null,
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
		lastOpenedAt: row.last_opened_at ? new Date(row.last_opened_at) : null,
	};
}

export type WorldLibrary = {
	worlds: WorldRecord[];
	usage: {count: number; max: number};
};

export type WorldExport = {
	editorSlug: string;
	exportedAt: string;
	format: "mothmark-world";
	schemaVersion: number;
	world: World;
	worldId: string;
	worldName: string;
	worldRevision: number;
};

export function createWorldExportDocument(
	world: Pick<WorldRecord, "editorSlug" | "id" | "name" | "revision" | "schemaVersion" | "world">,
	exportedAt = new Date(),
): WorldExport {
	return {
		editorSlug: world.editorSlug ?? worldSlugBaseForLegacyExport(world.name),
		exportedAt: exportedAt.toISOString(),
		format: "mothmark-world",
		schemaVersion: world.schemaVersion,
		world: WorldSchema.parse(world.world),
		worldId: world.id,
		worldName: world.name,
		worldRevision: world.revision,
	};
}

const worldSlugBaseForLegacyExport = (name: string) => createUniqueWorldSlug(name, []);

export type CreateOwnedWorldInput =
	{name: string; source: "blank" | "starter"} | {name: string; source: "import"; world: World};

export class WorldLimitReachedError extends Error {
	readonly code = "WORLD_LIMIT_REACHED";

	constructor(readonly maxWorlds: number) {
		super(`This account has reached its limit of ${maxWorlds} worlds.`);
		this.name = "WorldLimitReachedError";
	}
}

export function remainingWorldCapacity(activeWorlds: number, maxWorlds: number): number {
	return Math.max(0, maxWorlds - activeWorlds);
}

type UserLimitRow = {user_id: string; max_worlds: number};

export async function ensureDefaultUserLimits(
	transaction: Knex.Transaction,
	userId: string,
): Promise<UserLimitRow> {
	await transaction<UserLimitRow>("user_limits")
		.insert({user_id: userId, max_worlds: DEFAULT_MAX_WORLDS})
		.onConflict("user_id")
		.ignore();
	const limit = await transaction<UserLimitRow>("user_limits").where({user_id: userId}).first();
	if (!limit) throw new Error("The user's world limit could not be resolved.");
	return limit;
}

async function recordWorldOpened(
	transaction: Knex.Transaction | Knex,
	userId: string,
	worldId: string,
): Promise<void> {
	await transaction("user_world_activity")
		.insert({user_id: userId, world_id: worldId, last_opened_at: transaction.fn.now()})
		.onConflict(["user_id", "world_id"])
		.merge({last_opened_at: transaction.fn.now()});
}

async function requireAvailableWorldCapacity(
	transaction: Knex.Transaction,
	ownerUserId: string,
): Promise<void> {
	const limit = await ensureDefaultUserLimits(transaction, ownerUserId);
	const activeCount = await transaction("worlds")
		.where({owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.count<{count: string}>("id as count")
		.first();
	if (remainingWorldCapacity(Number(activeCount?.count ?? 0), limit.max_worlds) === 0) {
		throw new WorldLimitReachedError(limit.max_worlds);
	}
}

export async function createOwnedEditorSlug(
	transaction: Knex.Transaction,
	ownerUserId: string,
	name: string,
): Promise<string> {
	const existing = await transaction<{editor_slug: string}>("worlds")
		.select("editor_slug")
		.where("owner_user_id", ownerUserId)
		.where("kind", "editor")
		.whereNotNull("editor_slug");
	return createUniqueWorldSlug(
		name,
		existing.map((world) => world.editor_slug),
	);
}

/** Lists only active editor worlds owned by the actor. */
export async function listOwnedWorlds(ownerUserId: string): Promise<WorldRecord[]> {
	const rows = await database<WorldRow>("worlds as w")
		.leftJoin("user_world_activity as a", function () {
			this.on("a.world_id", "=", "w.id").andOn("a.user_id", "=", "w.owner_user_id");
		})
		.select("w.*", "a.last_opened_at")
		.where({"w.owner_user_id": ownerUserId, "w.kind": "editor"})
		.whereNull("w.deleted_at")
		.orderByRaw("a.last_opened_at desc nulls last")
		.orderBy("w.updated_at", "desc");
	return rows.map(mapWorldRow);
}

/** Lists only recoverable, trashed editor worlds owned by the actor. */
export async function listOwnedTrashedWorlds(ownerUserId: string): Promise<WorldRecord[]> {
	const rows = await database<WorldRow>("worlds")
		.where({owner_user_id: ownerUserId, kind: "editor"})
		.whereNotNull("deleted_at")
		.orderBy("deleted_at", "desc");
	return rows.map(mapWorldRow);
}

export async function getOwnedWorldLibrary(ownerUserId: string): Promise<WorldLibrary> {
	const [worlds, limit] = await Promise.all([
		listOwnedWorlds(ownerUserId),
		database<UserLimitRow>("user_limits").where({user_id: ownerUserId}).first(),
	]);
	return {
		worlds,
		usage: {count: worlds.length, max: limit?.max_worlds ?? DEFAULT_MAX_WORLDS},
	};
}

/** Resolves missing, deleted, template, and another user's worlds identically. */
export async function getOwnedWorld(
	ownerUserId: string,
	id: string,
): Promise<WorldRecord | undefined> {
	const row = await database<WorldRow>("worlds")
		.where({id, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.first();
	if (!row) return undefined;
	await recordWorldOpened(database, ownerUserId, id);
	return mapWorldRow({...row, last_opened_at: new Date()});
}

/** Resolves a private editor slug only inside the current owner's active-world scope. */
export async function getOwnedWorldBySlug(
	ownerUserId: string,
	editorSlug: string,
): Promise<WorldRecord | undefined> {
	const row = await database<WorldRow>("worlds")
		.where({editor_slug: editorSlug, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.first();
	if (!row) return undefined;
	await recordWorldOpened(database, ownerUserId, row.id);
	return mapWorldRow({...row, last_opened_at: new Date()});
}

export function createBlankWorldDocument(name = "Untitled world"): World {
	return produce(initialWorld, (draft) => {
		draft.metadata.title = name;
		draft.metadata.author = "";
		draft.metadata.description = "";
		draft.metadata.version = "0.1.0";
		draft.metadata.layers = [];
		draft.startRoomId = toID("room", "room-1");
		draft.rooms = [];
		draft.items = [];
		draft.connections = [];
		draft.conditions = [];
		draft.effects = [];
		draft.events = [];
	});
}

export async function createOwnedWorld(
	ownerUserId: string,
	input: CreateOwnedWorldInput,
): Promise<WorldRecord> {
	return database.transaction(async (transaction) => {
		const owner = await transaction("users").where({id: ownerUserId}).forUpdate().first();
		if (!owner) throw new Error("The world owner could not be resolved.");
		await requireAvailableWorldCapacity(transaction, ownerUserId);

		let sourceWorld = input.source === "import" ? input.world : createBlankWorldDocument(input.name);
		let schemaVersion = 1;
		if (input.source === "starter") {
			const template = await transaction<WorldRow>("worlds")
				.where({kind: "template", slug: "main"})
				.first();
			if (!template) throw new Error("The starter template could not be resolved.");
			sourceWorld = template.world;
			schemaVersion = template.schema_version;
		}
		sourceWorld = produce(sourceWorld, (draft) => {
			draft.metadata.title = input.name;
		});
		const editorSlug = await createOwnedEditorSlug(transaction, ownerUserId, input.name);

		const [row] = await transaction<WorldRow>("worlds")
			.insert({
				editor_slug: editorSlug,
				name: input.name,
				slug: null,
				world: sourceWorld,
				schema_version: schemaVersion,
				kind: "editor",
				owner_user_id: ownerUserId,
				updated_by_user_id: ownerUserId,
			})
			.returning("*");
		if (!row) throw new Error("The world could not be created.");
		await recordWorldOpened(transaction, ownerUserId, row.id);
		return mapWorldRow({...row, last_opened_at: new Date()});
	});
}

/** Updates an active editor world only within its owner's authorization scope. */
export async function updateOwnedWorld(
	ownerUserId: string,
	id: string,
	input: UpdateWorldInput,
	expectedRevision?: number,
): Promise<WorldRecord | undefined> {
	const query = database<WorldRow>("worlds")
		.where({id, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at");

	if (expectedRevision !== undefined) query.where({revision: expectedRevision});

	const [row] = await query
		.update({
			...(input.name !== undefined && {name: input.name}),
			...(input.world !== undefined && {world: input.world}),
			updated_by_user_id: ownerUserId,
			revision: database.raw("?? + 1", ["revision"]),
			updated_at: database.fn.now(),
		})
		.returning("*");

	return row ? mapWorldRow(row) : undefined;
}

/** Soft-deletes an active editor world only within its owner's authorization scope. */
export async function deleteOwnedWorld(ownerUserId: string, id: string): Promise<boolean> {
	const now = new Date();
	const updatedCount = await database<WorldRow>("worlds")
		.where({id, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.update({
			deleted_at: now,
			trash_purge_after: new Date(now.getTime() + TRASH_RECOVERY_MS),
			updated_by_user_id: ownerUserId,
		});
	return updatedCount > 0;
}

export async function duplicateOwnedWorld(
	ownerUserId: string,
	id: string,
): Promise<WorldRecord | undefined> {
	return database.transaction(async (transaction) => {
		const owner = await transaction("users").where({id: ownerUserId}).forUpdate().first();
		if (!owner) return undefined;
		const source = await transaction<WorldRow>("worlds")
			.where({id, owner_user_id: ownerUserId, kind: "editor"})
			.whereNull("deleted_at")
			.first();
		if (!source) return undefined;
		await requireAvailableWorldCapacity(transaction, ownerUserId);

		const suffix = " copy";
		const name = `${source.name.slice(0, 80 - suffix.length).trimEnd()}${suffix}`;
		const world = produce(source.world, (draft) => {
			draft.metadata.title = name;
		});
		const editorSlug = await createOwnedEditorSlug(transaction, ownerUserId, name);
		const [row] = await transaction<WorldRow>("worlds")
			.insert({
				editor_slug: editorSlug,
				name,
				slug: null,
				world,
				schema_version: source.schema_version,
				kind: "editor",
				owner_user_id: ownerUserId,
				updated_by_user_id: ownerUserId,
			})
			.returning("*");
		if (!row) throw new Error("The world copy could not be created.");
		await recordWorldOpened(transaction, ownerUserId, row.id);
		return mapWorldRow({...row, last_opened_at: new Date()});
	});
}

export async function restoreOwnedWorld(
	ownerUserId: string,
	id: string,
): Promise<WorldRecord | undefined> {
	return database.transaction(async (transaction) => {
		const owner = await transaction("users").where({id: ownerUserId}).forUpdate().first();
		if (!owner) return undefined;
		const trashed = await transaction<WorldRow>("worlds")
			.where({id, owner_user_id: ownerUserId, kind: "editor"})
			.whereNotNull("deleted_at")
			.first();
		if (!trashed) return undefined;
		await requireAvailableWorldCapacity(transaction, ownerUserId);
		const [row] = await transaction<WorldRow>("worlds")
			.where({id, owner_user_id: ownerUserId, kind: "editor"})
			.whereNotNull("deleted_at")
			.update({deleted_at: null, trash_purge_after: null, updated_by_user_id: ownerUserId})
			.returning("*");
		return row ? mapWorldRow(row) : undefined;
	});
}

/** Permanently deletes only a world already in the owner's trash. */
export async function permanentlyDeleteOwnedWorld(
	ownerUserId: string,
	id: string,
): Promise<boolean> {
	const deletedCount = await database<WorldRow>("worlds")
		.where({id, owner_user_id: ownerUserId, kind: "editor"})
		.whereNotNull("deleted_at")
		.delete();
	return deletedCount > 0;
}

export async function exportOwnedWorld(
	ownerUserId: string,
	id: string,
): Promise<WorldExport | undefined> {
	const row = await database<WorldRow>("worlds")
		.where({id, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.first();
	if (!row) return undefined;
	return createWorldExportDocument({
		editorSlug: row.editor_slug,
		id: row.id,
		name: row.name,
		revision: row.revision,
		schemaVersion: row.schema_version,
		world: row.world,
	});
}
