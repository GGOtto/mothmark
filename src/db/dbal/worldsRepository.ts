import "server-only";

import type {World} from "@/schemas/world/worldSchema";

import {getDb} from "./knex";

const database = getDb();

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
	};
}

/** Lists only active editor worlds owned by the actor. */
export async function listOwnedWorlds(ownerUserId: string): Promise<WorldRecord[]> {
	const rows = await database<WorldRow>("worlds")
		.where({owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.orderBy("updated_at", "desc");
	return rows.map(mapWorldRow);
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
	return row ? mapWorldRow(row) : undefined;
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
