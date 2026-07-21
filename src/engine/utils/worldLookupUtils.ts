import type {ConditionDefinition} from "@/schemas/world/conditionSchema";
import type {Room, World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";

/** Finds authored room data without applying runtime state changes. */
export function getRoom(world: World, roomId: ID<"room">): Room {
	const room = world.rooms.find((candidate) => compareIds(candidate.id, roomId));
	if (!room) throw new Error(`Missing room: ${roomId.id}`);
	return room;
}

/** Finds a condition using a condition reference */
export function getCondition(world: World, conditionId: ID<"condition">): ConditionDefinition {
	const storedCondition = world.conditions.find((candidate) =>
		compareIds(candidate.identity, conditionId),
	);
	if (!storedCondition) throw new Error(`Missing condition: ${conditionId.id}`);
	return storedCondition.condition;
}

type VariableLookup<TValue> = {exists: true; value: TValue} | {exists: false; value: undefined};

export function findVariable<TValue>(
	repository: Record<string, TValue>[],
	key: string,
): VariableLookup<TValue> {
	for (const values of repository) {
		if (Object.prototype.hasOwnProperty.call(values, key)) {
			return {exists: true, value: values[key]};
		}
	}

	return {exists: false, value: undefined};
}
