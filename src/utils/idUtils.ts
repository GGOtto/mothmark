import type {World} from "@/schemas/worldSchema";
import type {RoomFeature} from "@/schemas/roomSchema";

/** Minimal shape required by helpers that inspect or generate IDs. */
export type Identifiable = {
	id: ID | string;
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
	| "feature"
	| "container"
	| "surface"
	| "object";

/** Entity kinds used by declarations that are not top-level world collections. */
export type IdEntityType =
	| WorldIdEntityType
	| "command-branch"
	| "npc-schedule-entry"
	| "event-instance"
	| "condition-instance";

/** Reference to an entity ID in world data. */
export type ID<TEntityType extends IdEntityType = IdEntityType> = {
	type: TEntityType;
	id: string;
};

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

type CollectionEntityType = keyof typeof ENTITY_COLLECTIONS;

function hasEntityCollection(entityType: WorldIdEntityType): entityType is CollectionEntityType {
	return entityType in ENTITY_COLLECTIONS;
}

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
	container: new Set(["containerId"]),
	surface: new Set(["surfaceId"]),
	object: new Set(["objectId", "targetId"]),
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
	container: new Set<string>(),
	surface: new Set<string>(),
	object: new Set<string>(),
} as const satisfies Record<WorldIdEntityType, ReadonlySet<string>>;

/**
 * Returns the first unused `${prefix}-${number}` ID.
 *
 * Gaps are reused, so `room-1` and `room-3` produce `room-2`.
 */
export function generateUniqueId(prefix: string, existingItems: Identifiable[]) {
	const usedIds = new Set(existingItems.map((item) => idValue(item.id)));

	let nextNumber = 1;
	let nextId = `${prefix}-${nextNumber}`;

	while (usedIds.has(nextId)) {
		nextNumber += 1;
		nextId = `${prefix}-${nextNumber}`;
	}

	return nextId;
}

/** Returns true when `value` is an entity ID reference object. */
export function isID(value: unknown): value is ID {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"type" in value &&
		"id" in value &&
		typeof (value as ID).type === "string" &&
		typeof (value as ID).id === "string"
	);
}

/** Creates an entity ID reference from a string or existing reference. */
export function toID<TEntityType extends IdEntityType>(
	entityType: TEntityType,
	value: string | ID<TEntityType>,
): ID<TEntityType> {
	if (isID(value)) return value as ID<TEntityType>;
	return {type: entityType, id: value};
}

/** Returns the declared entity type without exposing the ID representation to callers. */
export function getEntityType<TEntityType extends IdEntityType>(
	value: ID<TEntityType>,
): TEntityType {
	return value.type;
}

/** Returns whether two IDs identify the same entity. */
export function compareIds(left: ID | undefined | null, right: ID | undefined | null) {
	return Boolean(left && right && left.type === right.type && left.id === right.id);
}

/** Returns the raw string ID from an entity ID reference or legacy string value. */
export function idValue(value: string | ID | undefined | null) {
	if (!value) return "";
	return isID(value) ? value.id : value;
}

/**
 * Renames an entity ID in world data and updates known references to it.
 *
 * The world is mutated in place. Returns `false` when the source entity is not found
 * or when `newId` would duplicate another entity in the same scope.
 */
export function updateWorldEntityId(
	world: World,
	oldReference: ID<WorldIdEntityType>,
	newReference: ID<WorldIdEntityType> | string,
) {
	const entityType = oldReference.type;
	const oldId = oldReference.id;
	const newId = idValue(newReference);
	if (!oldId || !newId || oldId === newId) return true;

	const entity = findWorldEntity(world, entityType, oldId);
	if (!entity) return false;
	if (hasDuplicateWorldEntityId(world, entityType, newId, entity)) return false;

	const oldLocalId = idValue(entity.id);
	const oldCompositeId = getCompositeEntityId(world, entityType, oldId);
	entity.id = toID(entityType, newId);

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
export function deleteWorldEntity(world: World, reference: ID<WorldIdEntityType>) {
	const {type: entityType, id} = reference;
	const entity = findWorldEntity(world, entityType, id);
	if (!entity) return false;

	const removedCompositeIds = getDeletedCompositeIds(world, entityType, id);
	if (!removeWorldEntity(world, entityType, id)) return false;

	pruneWorldReferences(world, entityType, idValue(entity.id));
	for (const compositeId of removedCompositeIds) {
		pruneCompositeReferences(world, compositeId);
	}

	if (entityType === "room") {
		const fallbackRoomId = world.rooms[0]?.id;
		if (fallbackRoomId && idValue(world.startRoomId) === id) {
			world.startRoomId = toID("room", idValue(fallbackRoomId));
		}
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
	reference: ID<WorldIdEntityType>,
): string | undefined {
	const {type: entityType, id} = reference;
	const entity = findWorldEntity(world, entityType, id);
	if (!entity) return undefined;

	return entity.name ?? entity.title ?? entity.label ?? idValue(entity.id);
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
			const objectiveIndex = quest.objectives.findIndex((objective) => idValue(objective.id) === id);
			if (objectiveIndex >= 0) {
				quest.objectives.splice(objectiveIndex, 1);
				return true;
			}
		}

		return false;
	}

	if (!hasEntityCollection(entityType)) return false;

	const collectionKey = ENTITY_COLLECTIONS[entityType];
	const collection = world[collectionKey];
	if (!Array.isArray(collection)) return false;

	const entityIndex = (collection as NamedEntity[]).findIndex((entity) => idValue(entity.id) === id);
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
		const room = world.rooms.find((candidateRoom) => idValue(candidateRoom.id) === id);
		return room ? room.features.map((feature) => `${idValue(room.id)}.${idValue(feature.id)}`) : [];
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

	if (!hasEntityCollection(entityType)) return undefined;

	const collectionKey = ENTITY_COLLECTIONS[entityType];
	const collection = world[collectionKey];
	if (!Array.isArray(collection)) return undefined;

	return (collection as NamedEntity[]).find((entity) => idValue(entity.id) === id);
}

function findWorldFeature(world: World, id: string) {
	for (const room of world.rooms) {
		const feature = room.features.find(
			(candidateFeature) =>
				idValue(candidateFeature.id) === id ||
				`${idValue(room.id)}.${idValue(candidateFeature.id)}` === id,
		);
		if (feature) return {room, feature};
	}

	return undefined;
}

function findQuestObjective(world: World, id: string) {
	for (const quest of world.quests) {
		const objective = quest.objectives.find(
			(candidateObjective) => idValue(candidateObjective.id) === id,
		);
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
		const locatedFeature = findWorldFeature(world, idValue(entity.id));
		if (!locatedFeature) return true;

		return locatedFeature.room.features.some(
			(feature) => feature !== locatedFeature.feature && idValue(feature.id) === newId,
		);
	}

	if (entityType === "quest-objective") {
		for (const quest of world.quests) {
			if (
				quest.objectives.some((objective) => objective !== entity && idValue(objective.id) === newId)
			) {
				return true;
			}
		}

		return false;
	}

	if (!hasEntityCollection(entityType)) return true;

	const collectionKey = ENTITY_COLLECTIONS[entityType];
	const collection = world[collectionKey];
	if (!Array.isArray(collection)) return true;

	return (collection as NamedEntity[]).some(
		(candidateEntity) => candidateEntity !== entity && idValue(candidateEntity.id) === newId,
	);
}

function getCompositeEntityId(world: World, entityType: WorldIdEntityType, id: string) {
	if (entityType !== "feature") return id;

	const locatedFeature = findWorldFeature(world, id);
	if (!locatedFeature) return undefined;

	return `${idValue(locatedFeature.room.id)}.${idValue(locatedFeature.feature.id)}`;
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

	if (isID(value) && value.type === entityType && value.id === oldId) {
		value.id = newId;
		return;
	}

	const record = value as Record<string, unknown>;
	for (const [key, childValue] of Object.entries(record)) {
		if (
			typeof childValue === "string" &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key) &&
			childValue === oldId
		) {
			record[key] = newId;
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

	if (isID(value) && value.id === oldId) {
		value.id = newId;
		return;
	}

	const record = value as Record<string, unknown>;
	const referenceKeys =
		entityType === "feature"
			? new Set(["featureId", "objectId", "containerId", "surfaceId"])
			: undefined;

	for (const [key, childValue] of Object.entries(record)) {
		if (
			typeof childValue === "string" &&
			(!referenceKeys || referenceKeys.has(key)) &&
			childValue === oldId
		) {
			record[key] = newId;
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

	if (isID(value) && value.type === entityType && value.id === deletedId) return;

	const record = value as Record<string, unknown>;
	for (const [key, childValue] of Object.entries(record)) {
		if (Array.isArray(childValue) && REFERENCE_ARRAY_KEYS_BY_ENTITY_TYPE[entityType].has(key)) {
			record[key] = childValue.filter((item) => item !== deletedId);
			continue;
		}

		if (
			typeof childValue === "string" &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key) &&
			childValue === deletedId
		) {
			if (isOptionalReferenceKey(entityType, key)) {
				delete record[key];
			}
			continue;
		}

		if (
			isID(childValue) &&
			childValue.type === entityType &&
			childValue.id === deletedId &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key)
		) {
			if (isOptionalReferenceKey(entityType, key)) {
				delete record[key];
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

	if (isID(value)) {
		return value.type === entityType && value.id === deletedId;
	}

	for (const [key, childValue] of Object.entries(value)) {
		if (
			typeof childValue === "string" &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key) &&
			childValue === deletedId &&
			!isOptionalReferenceKey(entityType, key)
		) {
			return true;
		}

		if (
			isID(childValue) &&
			childValue.type === entityType &&
			childValue.id === deletedId &&
			REFERENCE_KEYS_BY_ENTITY_TYPE[entityType].has(key)
		) {
			if (isOptionalReferenceKey(entityType, key)) continue;
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

	if (isID(value) && value.id === deletedId) return;

	const record = value as Record<string, unknown>;
	for (const [key, childValue] of Object.entries(record)) {
		if (typeof childValue === "string" && childValue === deletedId) {
			if (key === "objectId" || key === "containerId" || key === "surfaceId") continue;
			delete record[key];
			continue;
		}

		pruneCompositeReferences(childValue, deletedId);
	}
}

function dependsOnCompositeReference(value: unknown, deletedId: string): boolean {
	if (Array.isArray(value)) return false;
	if (!isRecord(value)) return false;
	if (isID(value)) return value.id === deletedId;

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
				`${oldRoomId}.${idValue(feature.id)}`,
				`${newRoomId}.${idValue(feature.id)}`,
			);
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
