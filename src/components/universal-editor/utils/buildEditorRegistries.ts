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
	type?: string;
	name?: string;
	title?: string;
	description?: unknown;
	aliases?: string[];
	tags?: string[];
	kind?: string;
	listedInRoom?: boolean;
};

const DIRECTION_LABELS: Record<string, string> = {
	n: "North",
	ne: "Northeast",
	e: "East",
	se: "Southeast",
	s: "South",
	sw: "Southwest",
	w: "West",
	nw: "Northwest",
	up: "Up",
	down: "Down",
	in: "In",
	out: "Out",
};

function readableValue(value: string) {
	return (DIRECTION_LABELS[value] ?? value.replace(/[-_]+/g, " ")).replace(/^./, (character) =>
		character.toLocaleUpperCase(),
	);
}

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

function roomLayer(world: World, roomId: string) {
	const layer = world.metadata.layers.find((candidate) =>
		candidate.rooms.some((candidateRoomId) => idValue(candidateRoomId) === roomId),
	);
	return layer ?? {name: "Ground", layer: 0};
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
	const initialState =
		worldRecord.initialState && typeof worldRecord.initialState === "object"
			? (worldRecord.initialState as Record<string, unknown>)
			: {};
	const initialFlags = Array.isArray(initialState.flags) ? initialState.flags : [];
	const initialCounters = Array.isArray(initialState.counters) ? initialState.counters : [];
	const initialTexts = Array.isArray(initialState.texts) ? initialState.texts : [];
	const rooms = world.rooms.map((room, index) => {
		const option = entityOption(room, ["rooms", index]);
		const layer = roomLayer(world, option.id);
		return {
			...option,
			entityType: "room" as const,
			hierarchy: [{kind: "layer" as const, key: String(layer.layer), label: layer.name}],
		};
	});
	const connections = world.connections.map((connection, index) => {
		const fromRoom = rooms.find((room) => room.id === idValue(connection.fromRoomId));
		const toRoom = rooms.find((room) => room.id === idValue(connection.toRoomId));
		return {
			id: idValue(connection.id),
			label: `${fromRoom?.label ?? idValue(connection.fromRoomId)} to ${toRoom?.label ?? idValue(connection.toRoomId)}`,
			entityType: "connection" as const,
			hierarchy: [
				...(fromRoom?.hierarchy ?? []),
				...(fromRoom ? [{kind: "room" as const, key: fromRoom.id, label: fromRoom.label}] : []),
			],
			facts: [
				{label: "Direction", value: readableValue(connection.direction)},
				{label: "Return direction", value: readableValue(connection.returnDirection)},
				{label: "Pathway", value: readableValue(connection.pathway)},
			],
			relations: [
				{
					label: "Rooms",
					items: [
						{
							id: idValue(connection.fromRoomId),
							label: fromRoom?.label ?? idValue(connection.fromRoomId),
							entityType: "room" as const,
							detail: `From · ${readableValue(connection.direction)}`,
						},
						{
							id: idValue(connection.toRoomId),
							label: toRoom?.label ?? idValue(connection.toRoomId),
							entityType: "room" as const,
							detail: `To · ${readableValue(connection.returnDirection)}`,
						},
					],
				},
			],
			path: ["connections", index],
		};
	});
	const conditions = world.conditions.map((storedCondition, index) => {
		const legacyCondition = storedCondition as unknown as WorldEntity;
		const isWrapped =
			"identity" in storedCondition &&
			"condition" in storedCondition &&
			storedCondition.condition !== undefined;
		const conditionId = isWrapped ? idValue(storedCondition.identity) : idValue(legacyCondition.id);
		const conditionType = isWrapped ? storedCondition.condition.type : legacyCondition.type;

		return {
			id: conditionId,
			label: legacyCondition.name ?? legacyCondition.title ?? conditionId,
			description: conditionType ? `Stored ${conditionType} condition` : "Stored condition",
			facts: conditionType ? [{label: "Type", value: readableValue(conditionType)}] : [],
			entityType: "condition" as const,
			hierarchy: [
				{
					kind: "category" as const,
					key: String(conditionType ?? "condition"),
					label: String(conditionType ?? "condition")
						.replace(/[-_]+/g, " ")
						.replace(/^./, (character) => character.toLocaleUpperCase()),
				},
			],
			path: isWrapped ? ["conditions", index, "condition"] : ["conditions", index],
		};
	});
	const items = world.items.map((item, index) => {
		const option = entityOption(
			{
				...item,
				description: item.examine.text,
				kind: item.behaviors.map((behavior) => behavior.type).join(", "),
			},
			["items", index],
		);
		const location = item.initialState.location;
		const roomId = location.type === "room" ? idValue(location.roomId) : undefined;
		const roomOption = roomId ? rooms.find((room) => room.id === roomId) : undefined;
		return {
			...option,
			entityType: "item" as const,
			parentId: roomId,
			hierarchy: roomOption
				? [
						...(roomOption.hierarchy ?? []),
						{kind: "room" as const, key: roomOption.id, label: roomOption.label},
					]
				: [{kind: "category" as const, key: location.type, label: readableValue(location.type)}],
			facts: [
				{
					label: "Behaviors",
					value: item.behaviors.length
						? item.behaviors.map((behavior) => readableValue(behavior.type)).join(", ")
						: "Fixed item",
				},
				{label: "Starting location", value: readableValue(location.type)},
			],
			relations: roomOption
				? [
						{
							label: "Room",
							items: [{id: roomOption.id, label: roomOption.label, entityType: "room" as const}],
						},
					]
				: [],
		};
	});
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
	const effects = ((worldRecord.effects as WorldEntity[] | undefined) ?? []).map(
		(effect, index) => ({
			...entityOption(effect, ["effects", index]),
			entityType: "effect" as const,
			hierarchy: [{kind: "category" as const, key: "saved", label: "Saved effects"}],
		}),
	);
	const roomsWithRelations = rooms.map((room) => {
		const worldRoom = world.rooms.find((candidate) => idValue(candidate.id) === room.id);
		const layer = room.hierarchy?.[0];
		const roomItems = items.filter((item) => item.parentId === room.id);
		const roomConnections = world.connections.flatMap((connection) => {
			const isFrom = idValue(connection.fromRoomId) === room.id;
			const isTo = idValue(connection.toRoomId) === room.id;
			if (!isFrom && !isTo) return [];
			const otherRoomId = idValue(isFrom ? connection.toRoomId : connection.fromRoomId);
			const otherRoom = rooms.find((candidate) => candidate.id === otherRoomId);
			const direction = isFrom ? connection.direction : connection.returnDirection;
			return [
				{
					id: idValue(connection.id),
					label: otherRoom?.label ?? otherRoomId,
					entityType: "connection" as const,
					detail: `${readableValue(direction)} · ${readableValue(connection.pathway)}`,
				},
			];
		});

		return {
			...room,
			facts: [
				...(layer ? [{label: "Layer", value: layer.label}] : []),
				...(worldRoom
					? [
							{
								label: "Map position",
								value: `${worldRoom.metadata.position.x}, ${worldRoom.metadata.position.y}`,
							},
						]
					: []),
			],
			relations: [
				...(roomConnections.length ? [{label: "Connections", items: roomConnections}] : []),
				...(roomItems.length
					? [
							{
								label: "Items",
								items: roomItems.map((item) => ({
									id: item.id,
									label: item.label,
									entityType: "item" as const,
									detail: item.kind ? readableValue(item.kind) : undefined,
								})),
							},
						]
					: []),
			],
		};
	});
	const containers = items.filter((item) => item.kind?.split(", ").includes("container"));
	const surfaces = items.filter((item) => item.kind?.split(", ").includes("surface"));
	const objects = uniqueById(items);
	const tags = emptyTags();

	tags.rooms = collectTags(world.rooms);
	tags.items = collectTags(items);
	tags.npcs = collectTags(npcs);
	tags.topics = collectTags(topics);
	tags.quests = collectTags(quests);
	tags.commands = collectTags(commands);
	tags.events = collectTags(events);
	tags.all = [
		...new Set([
			...tags.rooms,
			...tags.items,
			...tags.npcs,
			...tags.topics,
			...tags.quests,
			...tags.commands,
			...tags.events,
		]),
	].sort();

	return {
		rooms: roomsWithRelations,
		connections,
		conditions,
		items,
		npcs,
		topics,
		quests,
		commands,
		events,
		effects,
		containers,
		surfaces,
		objects,
		flags: initialFlags.flatMap((entry) =>
			entry && typeof entry === "object" && "flag" in entry && typeof entry.flag === "string"
				? [keyOption(entry.flag, "world")]
				: [],
		),
		counters: initialCounters.flatMap((entry) =>
			entry && typeof entry === "object" && "counter" in entry && typeof entry.counter === "string"
				? [keyOption(entry.counter, "world")]
				: [],
		),
		texts: initialTexts.flatMap((entry) =>
			entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string"
				? [keyOption(entry.text, "world")]
				: [],
		),
		tags,
	};
}
