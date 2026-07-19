import type {World} from "@/schemas/world/worldSchema";
import type {
	EditorEntityOption,
	EditorKeyOption,
	EditorRegistries,
	EditorTagRegistry,
} from "@/types/editor/editorRegistryTypes";
import {idValue, type ID} from "@/utils/idUtils";

export type {EditorRegistries};

/** Builds lookup registries used by the universal editor controls. */

type WorldEntity = {
	id: string | ID;
	name?: string;
	title?: string;
	description?: unknown;
	aliases?: string[];
	tags?: string[];
	kind?: string;
};

function descriptionText(description: unknown): string | undefined {
	if (typeof description === "string") return description;
	if (description && typeof description === "object" && "default" in description) {
		const defaultDescription = (description as {default?: unknown}).default;
		return typeof defaultDescription === "string" ? defaultDescription : undefined;
	}

	return undefined;
}

function entityOption(entity: WorldEntity, path: Array<string | number>): EditorEntityOption {
	return {
		id: idValue(entity.id),
		label: entity.name ?? entity.title ?? idValue(entity.id),
		description: descriptionText(entity.description),
		aliases: entity.aliases,
		tags: entity.tags,
		kind: entity.kind,
		path,
	};
}

function keyOption(key: string, source?: string): EditorKeyOption {
	return {
		key,
		label: key,
		source,
	};
}

function uniqueById(options: EditorEntityOption[]) {
	const seen = new Set<string>();

	return options.filter((option) => {
		if (seen.has(option.id)) return false;
		seen.add(option.id);
		return true;
	});
}

function collectTags(entities: WorldEntity[]) {
	return [...new Set(entities.flatMap((entity) => entity.tags ?? []))].sort();
}

function emptyTags(): EditorTagRegistry {
	return {
		rooms: [],
		items: [],
		features: [],
		npcs: [],
		topics: [],
		quests: [],
		commands: [],
		events: [],
		all: [],
	};
}

export function buildEditorRegistries(world: World): EditorRegistries {
	const worldRecord = world as unknown as Record<string, WorldEntity[] | unknown>;
	const rooms = world.rooms.map((room, index) => entityOption(room, ["rooms", index]));
	const connections = world.connections.map((connection, index) => ({
		id: idValue(connection.id),
		label: `${idValue(connection.fromRoomId)} ${connection.direction} ${idValue(connection.toRoomId)}`,
		description: descriptionText(connection.description),
		path: ["connections", index],
	}));
	const conditions = ((worldRecord.conditions as WorldEntity[] | undefined) ?? []).map(
		(condition, index) => ({
			...entityOption(condition, ["conditions", index]),
			description: descriptionText(condition.description),
		}),
	);
	const items = ((worldRecord.items as WorldEntity[] | undefined) ?? []).map((item, index) =>
		entityOption(item, ["items", index]),
	);
	const npcs = ((worldRecord.npcs as WorldEntity[] | undefined) ?? []).map((npc, index) =>
		entityOption(npc, ["npcs", index]),
	);
	const topics = ((worldRecord.topics as WorldEntity[] | undefined) ?? []).map((topic, index) =>
		entityOption(topic, ["topics", index]),
	);
	const quests = ((worldRecord.quests as WorldEntity[] | undefined) ?? []).map((quest, index) =>
		entityOption(quest, ["quests", index]),
	);
	const commands = ((worldRecord.commands as WorldEntity[] | undefined) ?? []).map(
		(command, index) => entityOption(command, ["commands", index]),
	);
	const events = ((worldRecord.events as WorldEntity[] | undefined) ?? []).map((event, index) =>
		entityOption(event, ["events", index]),
	);
	const effects = ((worldRecord.effects as WorldEntity[] | undefined) ?? []).map((effect, index) =>
		entityOption(effect, ["effects", index]),
	);
	const features = world.rooms.flatMap((room, roomIndex) =>
		(room.features ?? []).map((feature, featureIndex) => ({
			...entityOption(feature, ["rooms", roomIndex, "features", featureIndex]),
			id: `${idValue(room.id)}.${idValue(feature.id)}`,
			parentId: idValue(room.id),
		})),
	);
	const containers = features.filter((feature) => feature.kind === "container");
	const surfaces = features.filter((feature) => feature.kind === "surface");
	const objects = uniqueById([...items, ...features]);
	const tags = emptyTags();

	tags.rooms = collectTags(world.rooms);
	tags.items = collectTags(items);
	tags.features = collectTags(features);
	tags.npcs = collectTags(npcs);
	tags.topics = collectTags(topics);
	tags.quests = collectTags(quests);
	tags.commands = collectTags(commands);
	tags.events = collectTags(events);
	tags.all = [
		...new Set([
			...tags.rooms,
			...tags.items,
			...tags.features,
			...tags.npcs,
			...tags.topics,
			...tags.quests,
			...tags.commands,
			...tags.events,
		]),
	].sort();

	return {
		rooms,
		connections,
		conditions,
		items,
		npcs,
		topics,
		quests,
		commands,
		events,
		effects,
		features,
		containers,
		surfaces,
		objects,
		flags: ((worldRecord.flags as string[] | undefined) ?? []).map((flag) =>
			keyOption(flag, "world"),
		),
		counters: ((worldRecord.counters as string[] | undefined) ?? []).map((counter) =>
			keyOption(counter, "world"),
		),
		tags,
	};
}
