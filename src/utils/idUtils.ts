import {produce} from "immer";
import type {World} from "@/schemas/world/worldSchema";
import type {RoomFeature} from "@/schemas/world/roomSchema";

export type Identifiable = {id: ID | string};

/**
 * The editor still knows how to render dormant entity pickers. Runtime world lookup,
 * mutation, and schemas only support the active room-map types below.
 * TODO: Narrow this union when the dormant UI controls get their own UI-only type.
 */
export type WorldIdEntityType =
	| "room"
	| "connection"
	| "condition"
	| "effect"
	| "feature"
	| "container"
	| "surface"
	| "object"
	| "item"
	| "npc"
	| "topic"
	| "quest"
	| "quest-objective"
	| "command"
	| "event";

export type IdEntityType =
	| WorldIdEntityType
	| "command"
	| "condition-branch"
	| "npc-schedule-entry"
	| "event-instance"
	| "condition-instance";
export type ID<TEntityType extends IdEntityType = IdEntityType> = {type: TEntityType; id: string};

type NamedEntity = Identifiable & {
	name?: string;
	title?: string;
	label?: string;
	features?: RoomFeature[];
};
type ActiveEntityType =
	"room" | "connection" | "condition" | "effect" | "feature" | "container" | "surface" | "object";

const ACTIVE_ENTITY_TYPES = [
	"room",
	"connection",
	"condition",
	"effect",
	"feature",
	"container",
	"surface",
	"object",
] as const;
const ENTITY_COLLECTIONS = {
	room: "rooms",
	connection: "connections",
	condition: "conditions",
	effect: "effects",
} as const;

export function generateUniqueId(prefix: string, existingItems: Identifiable[]) {
	const usedIds = new Set(existingItems.map((item) => idValue(item.id)));
	let nextNumber = 1;
	while (usedIds.has(`${prefix}-${nextNumber}`)) nextNumber += 1;
	return `${prefix}-${nextNumber}`;
}

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

export function toID<TEntityType extends IdEntityType>(
	entityType: TEntityType,
	value: string | ID<TEntityType>,
): ID<TEntityType> {
	return isID(value) ? (value as ID<TEntityType>) : {type: entityType, id: value};
}

export function getEntityType<TEntityType extends IdEntityType>(
	value: ID<TEntityType>,
): TEntityType {
	return value.type;
}

export function compareIds(left: unknown, right: unknown) {
	return isID(left) && isID(right) && left.type === right.type && left.id === right.id;
}

export function idValue(value: unknown): string {
	if (typeof value === "string") return value;
	return isID(value) ? value.id : "";
}

export function updateWorldEntityId(
	world: World,
	oldReference: ID<WorldIdEntityType>,
	newReference: ID<WorldIdEntityType> | string,
) {
	return produce(world, (draft) => {
		updateWorldEntityIdDraft(draft, oldReference, newReference);
	});
}

function updateWorldEntityIdDraft(
	world: World,
	oldReference: ID<WorldIdEntityType>,
	newReference: ID<WorldIdEntityType> | string,
) {
	if (!isActiveEntityType(oldReference.type)) return;
	const entity = findWorldEntity(world, oldReference.type, oldReference.id);
	const newId = idValue(newReference);
	if (!entity || !newId || oldReference.id === newId) return;
	if (hasDuplicateId(world, oldReference.type, entity, newId)) return;

	const oldLocalId = idValue(entity.id);
	const oldCompositeId = compositeFeatureId(world, oldReference.type, oldReference.id);
	entity.id = toID(oldReference.type, newId);
	updateTypedReferences(world, oldReference.type, oldLocalId, newId);

	const newCompositeId = compositeFeatureId(world, oldReference.type, newId);
	if (oldCompositeId && newCompositeId)
		updateCompositeReferences(world, oldCompositeId, newCompositeId);
	if (oldReference.type === "room") updateRoomFeatureReferences(world, oldReference.id, newId);
}

export function deleteWorldEntity(world: World, reference: ID<WorldIdEntityType>) {
	return produce(world, (draft) => {
		deleteWorldEntityDraft(draft, reference);
	});
}

function deleteWorldEntityDraft(world: World, reference: ID<WorldIdEntityType>) {
	if (!isActiveEntityType(reference.type)) return;
	const entity = findWorldEntity(world, reference.type, reference.id);
	if (!entity) return;

	if (isFeatureType(reference.type)) {
		const located = findWorldFeature(world, reference.id);
		if (!located) return;
		located.room.features.splice(located.room.features.indexOf(located.feature), 1);
	} else {
		const key = ENTITY_COLLECTIONS[reference.type];
		const collection = world[key] as NamedEntity[];
		collection.splice(collection.indexOf(entity), 1);
	}

	pruneRequiredReferences(world, reference.type, idValue(entity.id));
	if (reference.type === "room") {
		const fallback = world.rooms[0]?.id;
		if (fallback && idValue(world.startRoomId) === reference.id)
			world.startRoomId = toID("room", idValue(fallback));
	}
}

export function resolveWorldEntityId(
	value: unknown,
	world?: World,
): ID<WorldIdEntityType> | undefined {
	if (
		!value ||
		typeof value !== "object" ||
		!("id" in value) ||
		!isID(value.id) ||
		!isActiveEntityType(value.id.type) ||
		!value.id.id
	)
		return;
	if (world && !findWorldEntity(world, value.id.type, value.id.id)) return;
	return {type: value.id.type, id: value.id.id};
}

export function resolveWorldEntityName(
	world: World,
	reference: ID<WorldIdEntityType>,
): string | undefined {
	if (!isActiveEntityType(reference.type)) return;
	const entity = findWorldEntity(world, reference.type, reference.id);
	return entity ? (entity.name ?? entity.title ?? entity.label ?? idValue(entity.id)) : undefined;
}

function isActiveEntityType(value: string): value is ActiveEntityType {
	return (ACTIVE_ENTITY_TYPES as readonly string[]).includes(value);
}

function isFeatureType(
	type: ActiveEntityType,
): type is "feature" | "container" | "surface" | "object" {
	return type === "feature" || type === "container" || type === "surface" || type === "object";
}

function findWorldEntity(
	world: World,
	type: ActiveEntityType,
	id: string,
): NamedEntity | undefined {
	if (isFeatureType(type)) {
		const feature = findWorldFeature(world, id)?.feature;
		if (!feature) return;
		if (type === "container" && feature.kind !== "container") return;
		if (type === "surface" && feature.kind !== "surface") return;
		return feature;
	}
	return (world[ENTITY_COLLECTIONS[type]] as NamedEntity[]).find(
		(entity) => idValue(entity.id) === id,
	);
}

function findWorldFeature(world: World, id: string) {
	for (const room of world.rooms) {
		const feature = room.features.find(
			(candidate) =>
				idValue(candidate.id) === id || `${idValue(room.id)}.${idValue(candidate.id)}` === id,
		);
		if (feature) return {room, feature};
	}
}

function hasDuplicateId(world: World, type: ActiveEntityType, entity: NamedEntity, newId: string) {
	if (isFeatureType(type)) {
		const located = findWorldFeature(world, idValue(entity.id));
		return (
			!located ||
			located.room.features.some(
				(candidate) => candidate !== entity && idValue(candidate.id) === newId,
			)
		);
	}
	return (world[ENTITY_COLLECTIONS[type]] as NamedEntity[]).some(
		(candidate) => candidate !== entity && idValue(candidate.id) === newId,
	);
}

function compositeFeatureId(world: World, type: ActiveEntityType, id: string) {
	if (!isFeatureType(type)) return id;
	const located = findWorldFeature(world, id);
	return located ? `${idValue(located.room.id)}.${idValue(located.feature.id)}` : undefined;
}

function updateTypedReferences(
	value: unknown,
	type: ActiveEntityType,
	oldId: string,
	newId: string,
) {
	if (Array.isArray(value)) {
		for (const child of value) updateTypedReferences(child, type, oldId, newId);
		return;
	}
	if (!isRecord(value)) return;
	if (isID(value) && value.type === type && value.id === oldId) {
		value.id = newId;
		return;
	}
	for (const child of Object.values(value)) updateTypedReferences(child, type, oldId, newId);
}

function updateCompositeReferences(value: unknown, oldId: string, newId: string) {
	if (Array.isArray(value)) {
		for (const child of value) updateCompositeReferences(child, oldId, newId);
		return;
	}
	if (!isRecord(value)) return;
	if (isID(value) && value.id === oldId) value.id = newId;
	for (const [key, child] of Object.entries(value)) {
		if (typeof child === "string" && ["featureId", "objectId"].includes(key) && child === oldId)
			(value as Record<string, unknown>)[key] = newId;
		else updateCompositeReferences(child, oldId, newId);
	}
}

function updateRoomFeatureReferences(world: World, oldRoomId: string, newRoomId: string) {
	for (const room of world.rooms) {
		for (const feature of room.features)
			updateCompositeReferences(
				world,
				`${oldRoomId}.${idValue(feature.id)}`,
				`${newRoomId}.${idValue(feature.id)}`,
			);
	}
}

function pruneRequiredReferences(value: unknown, type: ActiveEntityType, deletedId: string) {
	if (Array.isArray(value)) {
		for (let index = value.length - 1; index >= 0; index -= 1) {
			const child = value[index];
			if (hasTypedReference(child, type, deletedId)) value.splice(index, 1);
			else pruneRequiredReferences(child, type, deletedId);
		}
		return;
	}
	if (isRecord(value))
		for (const child of Object.values(value)) pruneRequiredReferences(child, type, deletedId);
}

function hasTypedReference(value: unknown, type: ActiveEntityType, id: string): boolean {
	if (isID(value)) return value.type === type && value.id === id;
	if (Array.isArray(value)) return false;
	return isRecord(value) && Object.values(value).some((child) => hasTypedReference(child, type, id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
