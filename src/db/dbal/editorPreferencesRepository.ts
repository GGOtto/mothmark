import "server-only";

import {parseStoredWorld} from "@/compat/storageCodec";
import type {World} from "@/schemas/world/worldSchema";
import {
	DEFAULT_EDITOR_PREFERENCES,
	type EditorPreferences,
	type ItemActivity,
} from "@/editor/editorPreferences";
import {idValue} from "@/utils/idUtils";

import {getDb} from "./knex";

const database = getDb();

type EditorPreferencesRow = {
	user_id: string;
	item_list_view: EditorPreferences["itemListView"];
	item_list_sort: EditorPreferences["itemListSort"];
};

type ItemActivityRow = {
	world_id: string;
	item_id: string;
	created_at: Date | string;
	updated_at: Date | string;
};

type WorldActivitySourceRow = {
	id: string;
	owner_user_id: string;
	name: string;
	kind: "editor" | "template";
	world: unknown;
	schema_version: number;
	created_at: Date | string;
	updated_at: Date | string;
	deleted_at: Date | string | null;
};

const iso = (value: Date | string) => new Date(value).toISOString();

const mapPreferences = (row?: EditorPreferencesRow): EditorPreferences =>
	row
		? {itemListView: row.item_list_view, itemListSort: row.item_list_sort}
		: DEFAULT_EDITOR_PREFERENCES;

export async function getEditorPreferences(userId: string): Promise<EditorPreferences> {
	const row = await database<EditorPreferencesRow>("editor_preferences")
		.where({user_id: userId})
		.first();
	return mapPreferences(row);
}

export async function updateEditorPreferences(
	userId: string,
	input: Partial<EditorPreferences>,
): Promise<EditorPreferences> {
	const insert = {
		user_id: userId,
		item_list_view: input.itemListView ?? DEFAULT_EDITOR_PREFERENCES.itemListView,
		item_list_sort: input.itemListSort ?? DEFAULT_EDITOR_PREFERENCES.itemListSort,
		updated_at: database.fn.now(),
	};
	const merge = {
		...(input.itemListView !== undefined && {item_list_view: input.itemListView}),
		...(input.itemListSort !== undefined && {item_list_sort: input.itemListSort}),
		updated_at: database.fn.now(),
	};
	const [row] = await database<EditorPreferencesRow>("editor_preferences")
		.insert(insert)
		.onConflict("user_id")
		.merge(merge)
		.returning(["user_id", "item_list_view", "item_list_sort"]);
	if (!row) throw new Error("The editor preferences could not be saved.");
	return mapPreferences(row);
}

/** Returns undefined for absent, deleted, template, or differently owned worlds. */
export async function getOwnedItemActivity(
	ownerUserId: string,
	worldId: string,
): Promise<Record<string, ItemActivity> | undefined> {
	const world = await database<WorldActivitySourceRow>("worlds")
		.select("id", "name", "kind", "world", "schema_version", "created_at", "updated_at")
		.where({id: worldId, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.first();
	if (!world) return undefined;
	const storedWorld = parseStoredWorld(world.world, world.schema_version, {
		id: world.id,
		name: world.name,
		storage: "editor",
	});
	const itemIds = storedWorld.items.map((item) => idValue(item.id));

	const rows = itemIds.length
		? await database<ItemActivityRow>("editor_item_activity")
				.select("item_id", "created_at", "updated_at")
				.where({world_id: worldId})
				.whereIn("item_id", itemIds)
		: [];
	const recorded = new Map(rows.map((row) => [row.item_id, row]));
	return Object.fromEntries(
		itemIds.map((itemId) => {
			const row = recorded.get(itemId);
			return [
				itemId,
				row
					? {createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)}
					: {createdAt: iso(world.created_at), updatedAt: iso(world.updated_at)},
			];
		}),
	);
}

export type ItemActivitySnapshot = {
	world: World;
	createdAt: Date;
	updatedAt: Date;
};

export async function getOwnedItemActivitySnapshot(
	ownerUserId: string,
	worldId: string,
): Promise<ItemActivitySnapshot | undefined> {
	const row = await database<WorldActivitySourceRow>("worlds")
		.select("id", "name", "kind", "world", "schema_version", "created_at", "updated_at")
		.where({id: worldId, owner_user_id: ownerUserId, kind: "editor"})
		.whereNull("deleted_at")
		.first();
	return row
		? {
				world: parseStoredWorld(row.world, row.schema_version, {
					id: row.id,
					name: row.name,
					storage: "editor",
				}),
				createdAt: new Date(row.created_at),
				updatedAt: new Date(row.updated_at),
			}
		: undefined;
}

export async function recordItemActivity(input: {
	worldId: string;
	previousWorld: World;
	nextWorld: World;
	worldCreatedAt: Date;
	previousWorldUpdatedAt: Date;
}): Promise<void> {
	const previousById = new Map(
		input.previousWorld.items.map((item) => [idValue(item.id), JSON.stringify(item)]),
	);
	const now = new Date();
	const nextIds = input.nextWorld.items.map((item) => idValue(item.id));
	const rows = input.nextWorld.items.map((item) => {
		const itemId = idValue(item.id);
		const existed = previousById.has(itemId);
		const changed = previousById.get(itemId) !== JSON.stringify(item);
		return {
			world_id: input.worldId,
			item_id: itemId,
			created_at: existed ? input.worldCreatedAt : now,
			updated_at: changed ? now : input.previousWorldUpdatedAt,
			changed,
		};
	});

	await database.transaction(async (transaction) => {
		if (rows.length) {
			await transaction("editor_item_activity")
				.insert(
					rows.map((row) => ({
						world_id: row.world_id,
						item_id: row.item_id,
						created_at: row.created_at,
						updated_at: row.updated_at,
					})),
				)
				.onConflict(["world_id", "item_id"])
				.ignore();
			for (const row of rows) {
				if (!row.changed) continue;
				await transaction("editor_item_activity")
					.where({world_id: input.worldId, item_id: row.item_id})
					.update({updated_at: now});
			}
		}

		const deleted = transaction("editor_item_activity").where({world_id: input.worldId});
		if (nextIds.length) deleted.whereNotIn("item_id", nextIds);
		await deleted.delete();
	});
}
