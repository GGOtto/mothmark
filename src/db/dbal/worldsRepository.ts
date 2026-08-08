import "server-only";

import {produce} from "immer";
import type {Knex} from "knex";

import {world as initialWorld} from "@/data/worlds/initialWorld";
import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";

import {getDb} from "./knex";

const database = getDb();

export const DEFAULT_MAX_WORLDS = 5;

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
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
		lastOpenedAt: row.last_opened_at ? new Date(row.last_opened_at) : null,
	};
}

export type WorldLibrary = {
	worlds: WorldRecord[];
	usage: {count: number; max: number};
};

export type CreateOwnedWorldInput = {
	name: string;
	source: "starter" | "blank";
};

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
		const limit = await ensureDefaultUserLimits(transaction, ownerUserId);
		const activeCount = await transaction("worlds")
			.where({owner_user_id: ownerUserId, kind: "editor"})
			.whereNull("deleted_at")
			.count<{count: string}>("id as count")
			.first();
		if (remainingWorldCapacity(Number(activeCount?.count ?? 0), limit.max_worlds) === 0) {
			throw new WorldLimitReachedError(limit.max_worlds);
		}

		let sourceWorld = createBlankWorldDocument(input.name);
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

		const [row] = await transaction<WorldRow>("worlds")
			.insert({
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
	const updatedCount = await database<WorldRow>("worlds")
		.where({id, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.update({deleted_at: database.fn.now(), updated_by_user_id: ownerUserId});
	return updatedCount > 0;
}
