import "server-only";

import {WorldSchema, type World} from "@/schemas/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";

import {getDb} from "./knex";

const database = getDb();

export type WorldRecord = {
	id: string;
	name: string;
	slug: string | null;
	world: World;
	schemaVersion: number | null;
	createdAt: Date;
	updatedAt: Date;
};

type WorldRow = {
	id: string;
	name: string;
	slug: string | null;
	world: World;
	schema_version: number | null;
	created_at: Date | string;
	updated_at: Date | string;
};

export type CreateWorldInput = {
	name: string;
	slug?: string | null;
	world: World;
	schemaVersion?: number;
};

export type CreateDefaultWorldInput = {
	name: string;
	slug?: string | null;
	schemaVersion?: number;
};

export type UpdateWorldInput = {
	name?: string;
	slug?: string | null;
	world: World;
};

function mapWorldRow(row: WorldRow): WorldRecord {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		world: row.world,
		schemaVersion: row.schema_version,
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
	};
}

/**
 * Creates and returns a stored world.
 */
export async function createWorld(input: CreateWorldInput): Promise<WorldRecord> {
	const [row] = await database<WorldRow>("worlds")
		.insert({
			name: input.name,
			slug: input.slug ?? null,
			world: input.world,
			schema_version: input.schemaVersion ?? null,
		})
		.returning("*");

	if (!row) {
		throw new Error("Failed to create world.");
	}

	return mapWorldRow(row);
}

/**
 * Create a world with default fields.
 */
export async function createDefaultWorld(input: CreateDefaultWorldInput): Promise<WorldRecord> {
	const world = createDefaultFieldObject(WorldSchema);
	const row = await createWorld({world, ...input});
	return row;
}

/**
 * Gets a world by its database ID.
 *
 * Returns undefined when no matching world exists.
 */
export async function getWorld(id: string): Promise<WorldRecord | undefined> {
	const row = await database<WorldRow>("worlds").where({id}).first();

	return row ? mapWorldRow(row) : undefined;
}

/**
 * Updates a world's document and optional display metadata.
 *
 * This does not update schema_version. Use updateWorldSchemaVersion
 * when the stored document has been migrated to a newer schema.
 *
 * Returns undefined when no matching world exists.
 */
export async function updateWorld(id: string, world: World): Promise<WorldRecord | undefined> {
	const [updatedRow] = await database<WorldRow>("worlds")
		.where({id})
		.whereRaw("world IS DISTINCT FROM ?::jsonb", [JSON.stringify(world)])
		.update({
			world,
			updated_at: database.fn.now(),
		})
		.returning("*");

	if (updatedRow) {
		return mapWorldRow(updatedRow);
	}

	const existingRow = await database<WorldRow>("worlds").where({id}).first();

	return existingRow ? mapWorldRow(existingRow) : undefined;
}

/**
 * Updates the schema version associated with a stored world.
 *
 * This should normally be called only after the world document itself
 * has successfully been migrated.
 *
 * Returns undefined when no matching world exists.
 */
export async function updateWorldSchemaVersion(
	id: string,
	schemaVersion: number,
): Promise<WorldRecord | undefined> {
	if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
		throw new Error("schemaVersion must be a positive integer.");
	}

	const [row] = await database<WorldRow>("worlds")
		.where({id})
		.update({
			schema_version: schemaVersion,
			updated_at: database.fn.now(),
		})
		.returning("*");

	return row ? mapWorldRow(row) : undefined;
}
