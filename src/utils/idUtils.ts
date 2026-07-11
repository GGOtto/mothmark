import type {World} from "@/schemas/worldSchema";
import type {RoomFeature} from "@/schemas/roomSchema";

/** Minimal shape required by helpers that inspect or generate IDs. */
export type Identifiable = {
	id: string;
};

/** Entity kinds whose IDs can be resolved or updated inside world data. */
export type WorldIdEntityType =
	| "room"
	| "connection"
	| "condition"
	| "effect"
	| "item"
	| "npc"
	| "topic"
	| "quest"
	| "quest-objective"
	| "command"
	| "event"
	| "feature";

type NamedEntity = Identifiable & {
	name?: string;
	title?: string;
	label?: string;
	objectives?: NamedEntity[];
	features?: RoomFeature[];
};

const ENTITY_COLLECTIONS = {
	room: "rooms",
	connection: "connections",
	condition: "conditions",
	effect: "effects",
	item: "items",
	npc: "npcs",
	topic: "topics",
	quest: "quests",
	command: "authoredCommands",
	event: "authoredEvents",
} as const satisfies Partial<Record<WorldIdEntityType, keyof World>>;

const REFERENCE_KEYS_BY_ENTITY_TYPE = {
	room: new Set(["roomId", "fromRoomId", "toRoomId", "startRoomId", "initialRoomId"]),
	connection: new Set(["connectionId"]),
	condition: new Set(["conditionId"]),
	effect: new Set(["effectId"]),
	item: new Set(["itemId"]),
	npc: new Set(["npcId"]),
	topic: new Set(["topicId"]),
	quest: new Set(["questId"]),
	"quest-objective": new Set(["objectiveId"]),
	command: new Set(["commandId"]),
	event: new Set(["eventId"]),
	feature: new Set(["featureId"]),
} as const satisfies Record<WorldIdEntityType, ReadonlySet<string>>;

const REFERENCE_ARRAY_KEYS_BY_ENTITY_TYPE = {
	room: new Set<string>(),
	connection: new Set<string>(),
	condition: new Set<string>(),
	effect: new Set<string>(),
	item: new Set(["itemIds", "initialItems", "initialInventory", "inventory"]),
	npc: new Set<string>(),
	topic: new Set(["knownTopics"]),
	quest: new Set<string>(),
	"quest-objective": new Set<string>(),
	command: new Set<string>(),
	event: new Set<string>(),
	feature: new Set<string>(),
} as const satisfies Record<WorldIdEntityType, ReadonlySet<string>>;

/**
 * Returns the first unused `${prefix}-${number}` ID.
 *
 * Gaps are reused, so `room-1` and `room-3` produce `room-2`.
 */
export function generateUniqueId(prefix: string, existingItems: Identifiable[]) {
	const usedIds = new Set(existingItems.map((item) => item.id));

	let nextNumber = 1;
	let nextId = `${prefix}-${nextNumber}`;

	while (usedIds.has(nextId)) {
		nextNumber += 1;
		nextId = `${prefix}-${nextNumber}`;
	}

	return nextId;
}

/**
 * Renames an entity ID in world data and updates known references to it.
 *
 * The world is mutated in place. Returns `false` when the source entity is not found
 * or when `newId` would duplicate another entity in the same scope.
 */
export function updateWorldEntityId(
	world: World,
	entityType: WorldIdEntityType,
	oldId: string,
	newId: string,
) {
	if (!oldId || !newId || oldId === newId) return true;

	const entity = findWorldEntity(world, entityType, oldId);
	if (!entity) return false;
	if (hasDuplicateWorldEntityId(world, entityType, newId, entity)) return false;

	const oldLocalId = entity.id;
	const oldCompositeId = getCompositeEntityId(world, entityType, oldId);
	entity.id = newId;

	updateWorldIdReferences(world, entityType, oldLocalId, newId);

	const newCompositeId = getCompositeEntityId(world, entityType, newId);
	if (oldCompositeId && newCompositeId) {
		updateCompositeIdReferences(world, entityType, oldCompositeId, newCompositeId);
	}

	if (entityType === "room") {
		updateRoomScopedFeatureReferences(world, oldId, newId);
	}

	return true;
}

/**
 * Deletes an entity from world data and removes data that depends on its ID.
 *
 * The world is mutated in place. Required references delete the nearest owning
 * array item, while optional scalar references are unset and ID lists are filtered.
 * Returns `false` when the entity cannot be found.
 */
export function deleteWorldEntity(world: World, entityType: WorldIdEntityType, id: string) {
	const entity = findWorldEntity(world, entityType, id);
	if (!entity) return false;

	const removedCompositeIds = getDeletedCompositeIds(world, entityType, id);
	if (!removeWorldEntity(world, entityType, id)) return false;

	pruneWorldReferences(world, entityType, entity.id);
	for (const compositeId of removedCompositeIds) {
		pruneCompositeReferences(world, compositeId);
	}

	if (entityType === "room") {
		const fallbackRoomId = world.rooms[0]?.id ?? "";
		if (world.startRoomId === id) world.startRoomId = fallbackRoomId;
	}

	return true;
}

/**
 * Resolves a world entity ID to its display name.
 *
 * Falls back through `name`, `title`, `label`, then `id`. Returns `undefined`
 * when the entity cannot be found.
 */
export function resolveWorldEntityName(
	world: World,
	entityType: WorldIdEntityType,
	id: string,
): string | undefined {
	const entity = findWorldEntity(world, entityType, id);
	if (!entity) return undefined;

	return entity.name ?? entity.title ?? entity.label ?? entity.id;
}

function removeWorldEntity(world: World, entityType: WorldIdEntityType, id: string) {
	if (entityType === "feature") {
		const locatedFeature = findWorldFeature(world, id);
		if (!locatedFeature) return false;

		const featureIndex = locatedFeature.room.features.indexOf(locatedFeature.feature);
		locatedFeature.room.features.splice(featureIndex, 1);
		return true;
	}

	if (entityType === "quest-objective") {
		for (const quest of world.quests) {
			const objectiveIndex = quest.objectives.findIndex((objective) => objective.id === id);
			if (objectiveIndex >= 0) {
				quest.objectives.splice(objectiveIndex, 1);
				return true;
			}
		}

		return false;
	}

	const collectionKey = ENTITY_COLLECTIONS[entityType];
	const collection = collectionKey ? world[collectionKey] : undefined;
	if (!Array.isArray(collection)) return false;

	const entityIndex = (collection as NamedEntity[]).findIndex((entity) => entity.id === id);
	if (entityIndex < 0) return false;

	collection.splice(entityIndex, 1);
	return true;
}

function getDeletedCompositeIds(world: World, entityType: WorldIdEntityType, id: string) {
	if (entityType === "feature") {
		const compositeId = getCompositeEntityId(world, entityType, id);
		return compositeId ? [compositeId] : [];
	}

	if (entityType === "room") {
		const room = world.rooms.find((candidateRoom) => candidateRoom.id === id);
		return room ? room.features.map((feature) => `${room.id}.${feature.id}`) : [];
	}

	return [];
}

function findWorldEntity(
	world: World,
	entityType: WorldIdEntityType,
	id: string,
): NamedEntity | undefined {
	if (entityType === "feature") return findWorldFeature(world, id)?.feature;
	if (entityType === "quest-objective") return findQuestObjective(world, id);

	const collectionKey = ENTITY_COLLECTIONS[entityType];
	const collection = collectionKey ? world[collectionKey] : undefined;
	if (!Array.isArray(collection)) return undefined;

	return (collection as NamedEntity[]).find((entity) => entity.id === id);
}

function findWorldFeature(world: World, id: string) {
	for (const room of world.rooms) {
		const feature = room.features.find(
			(candidateFeature) => candidateFeature.id === id || `${room.id}.${candidateFeature.id}` === id,
		);
		if (feature) return {room, feature};
	}

	return undefined;
}

function findQuestObjective(world: World, id: string) {
	for (const quest of world.quests) {
		const objective = quest.objectives.find((candidateObjective) => candidateObjective.id === id);
		if (objective) return objective;
	}

	return undefined;
}

function hasDuplicateWorldEntityId(
	world: World,
	entityType: WorldIdEntityType,
	newId: string,
	entity: NamedEntity,
) {
	if (entityType === "feature") {
		const locatedFeature = findWorldFeature(world, entity.id);
		if (!locatedFeature) return true;

		return locatedFeature.room.features.some(
			(feature) => feature !== locatedFeature.feature && feature.id === newId,
		);
	}

	if (entityType === "quest-objective") {
		for (const quest of world.quests) {
			if (quest.objectives.some((objective) => objective !== entity && objective.id === newId)) {
				return true;
			}
		}

		return false;
	}

	const collectionKey = ENTITY_COLLECTIONS[entityType];
	const collection = collectionKey ? world[collectionKey] : undefined;
	if (!Array.isArray(collection)) return true;

	return (collection as NamedEntity[]).some(
		(candidateEntity) => candidateEntity !== entity && candidateEntity.id === newId,
	);
}

function getCompositeEntityId(world: World, entityType: WorldIdEntityType, id: string) {
	if (entityType !== "feature") return id;

	const locatedFeature = findWorldFeature(world, id);
	if (!locatedFeature) return undefined;

	return `${locatedFeature.room.id}.${locatedFeature.feature.id}`;
}

/** Updates typed references such as `roomId`, `itemId`, and known ID-list fields. */
function updateWorldIdReferences(
	value: unknown,
	entityType: WorldIdEntityType,
	oldId: string,
	newId: string,
	parentKey?: string,
) {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			if (
				typeof value[index] === "string" &&
				parentKey &&
				REFERENCE_ARRAY_KEYS_BY_ENTITY_TYPE[entityType].has(parentKey) &&
				value[index] === oldId
			) {
				value[index] = newId;
				continue;
			}

			updateWorldIdReferences(value[index], entityType, oldId, newId, parentKey);
		}
		return;
	}

	if (!isRecord(value)) return;

	for (const [key, childValue] of Object.entries(value)) {
		if (
			typeof childValue === "string" &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key) &&
			childValue === oldId
		) {
			value[key] = newId;
			continue;
		}

		updateWorldIdReferences(childValue, entityType, oldId, newId, key);
	}
}

/** Updates scoped object IDs such as `room.feature` after feature or room renames. */
function updateCompositeIdReferences(
	value: unknown,
	entityType: WorldIdEntityType,
	oldId: string,
	newId: string,
) {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			if (typeof value[index] === "string" && value[index] === oldId) {
				value[index] = newId;
				continue;
			}

			updateCompositeIdReferences(value[index], entityType, oldId, newId);
		}
		return;
	}

	if (!isRecord(value)) return;

	const referenceKeys =
		entityType === "feature"
			? new Set(["featureId", "objectId", "containerId", "surfaceId"])
			: undefined;

	for (const [key, childValue] of Object.entries(value)) {
		if (
			typeof childValue === "string" &&
			(!referenceKeys || referenceKeys.has(key)) &&
			childValue === oldId
		) {
			value[key] = newId;
			continue;
		}

		updateCompositeIdReferences(childValue, entityType, oldId, newId);
	}
}

function pruneWorldReferences(value: unknown, entityType: WorldIdEntityType, deletedId: string) {
	if (Array.isArray(value)) {
		for (let index = value.length - 1; index >= 0; index -= 1) {
			const childValue = value[index];

			if (typeof childValue === "string") continue;

			if (dependsOnRequiredReference(childValue, entityType, deletedId)) {
				value.splice(index, 1);
				continue;
			}

			pruneWorldReferences(childValue, entityType, deletedId);
		}

		return;
	}

	if (!isRecord(value)) return;

	for (const [key, childValue] of Object.entries(value)) {
		if (Array.isArray(childValue) && REFERENCE_ARRAY_KEYS_BY_ENTITY_TYPE[entityType].has(key)) {
			value[key] = childValue.filter((item) => item !== deletedId);
			continue;
		}

		if (
			typeof childValue === "string" &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key) &&
			childValue === deletedId
		) {
			if (isOptionalReferenceKey(entityType, key)) {
				delete value[key];
			}
			continue;
		}

		pruneWorldReferences(childValue, entityType, deletedId);
	}
}

function dependsOnRequiredReference(
	value: unknown,
	entityType: WorldIdEntityType,
	deletedId: string,
): boolean {
	if (Array.isArray(value)) return false;

	if (!isRecord(value)) return false;

	for (const [key, childValue] of Object.entries(value)) {
		if (
			typeof childValue === "string" &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key) &&
			childValue === deletedId &&
			!isOptionalReferenceKey(entityType, key)
		) {
			return true;
		}

		if (dependsOnRequiredReference(childValue, entityType, deletedId)) return true;
	}

	return false;
}

function pruneCompositeReferences(value: unknown, deletedId: string) {
	if (Array.isArray(value)) {
		for (let index = value.length - 1; index >= 0; index -= 1) {
			const childValue = value[index];

			if (childValue === deletedId || dependsOnCompositeReference(childValue, deletedId)) {
				value.splice(index, 1);
				continue;
			}

			pruneCompositeReferences(childValue, deletedId);
		}

		return;
	}

	if (!isRecord(value)) return;

	for (const [key, childValue] of Object.entries(value)) {
		if (typeof childValue === "string" && childValue === deletedId) {
			if (key === "objectId" || key === "containerId" || key === "surfaceId") continue;
			delete value[key];
			continue;
		}

		pruneCompositeReferences(childValue, deletedId);
	}
}

function dependsOnCompositeReference(value: unknown, deletedId: string): boolean {
	if (Array.isArray(value)) return false;
	if (!isRecord(value)) return false;

	return Object.entries(value).some(([key, childValue]) => {
		if (typeof childValue !== "string" || childValue !== deletedId) {
			return dependsOnCompositeReference(childValue, deletedId);
		}

		return key === "objectId" || key === "containerId" || key === "surfaceId";
	});
}

function isOptionalReferenceKey(entityType: WorldIdEntityType, key: string) {
	return entityType === "room" && key === "initialRoomId";
}

/** Keeps feature object IDs stable when the room portion of `room.feature` changes. */
function updateRoomScopedFeatureReferences(world: World, oldRoomId: string, newRoomId: string) {
	for (const room of world.rooms) {
		for (const feature of room.features) {
			updateCompositeIdReferences(
				world,
				"feature",
				`${oldRoomId}.${feature.id}`,
				`${newRoomId}.${feature.id}`,
			);
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
