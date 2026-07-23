import type {GameState} from "@/schemas/states/gameStateSchema";
import type {SingleCondition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, ID} from "@/utils/idUtils";
import {getRoom} from "../utils/lookupUtils";
import {EntityState} from "@/schemas/states/entityStates";
import {findVariable} from "../utils/lookupUtils";

function findStateById(states: EntityState[], id: ID): EntityState | undefined {
	for (const state of states) {
		if (compareIds(state.id, id)) {
			return state;
		}
	}
}

function evaluateFlag(
	game: GameState,
	condition: Extract<SingleCondition, {type: "flag"}>,
): boolean {
	if (condition["flag-type"] === "room") {
		const room = findStateById(game.roomStates, condition.roomId);
		if (!room || room.type !== "room") return false;
		return evaluateFlagValue(room.flags, condition.flag, condition.operation);
	}
	if (condition["flag-type"] === "feature") {
		const room = findStateById(game.roomStates, condition.roomId);
		if (!room || room.type !== "room") return false;
		const feature = findStateById(room.featureStates, condition.featureId);
		if (!feature || feature.type !== "feature") return false;
		return evaluateFlagValue(feature.flags, condition.flag, condition.operation);
	}

	const flag = findVariable(game.variables.flags, condition.flag);
	return evaluateFlagResult(flag.exists, flag.value, condition.operation);
}

function evaluateFlagResult(
	exists: boolean,
	value: boolean | undefined,
	operation: "true" | "false" | "exists" | "missing",
): boolean {
	switch (operation) {
		case "true":
			return exists && Boolean(value);
		case "false":
			return exists && !value;
		case "exists":
			return exists;
		case "missing":
			return !exists;
	}
}

function evaluateFlagValue(
	flags: Record<string, boolean>,
	flag: string,
	operation: "true" | "false" | "exists" | "missing",
): boolean {
	return evaluateFlagResult(Object.hasOwn(flags, flag), flags[flag], operation);
}

function compareCounter(left: number, operator: string, right: number): boolean {
	switch (operator) {
		case "eq":
			return left === right;
		case "neq":
			return left !== right;
		case "gt":
			return left > right;
		case "gte":
			return left >= right;
		case "lt":
			return left < right;
		case "lte":
			return left <= right;
		default:
			return false;
	}
}

function evaluateCounter(
	game: GameState,
	condition: Extract<SingleCondition, {type: "counter"}>,
): boolean {
	const counter = findVariable(game.variables.counters, condition.counter);

	switch (condition.operation) {
		case "compare":
			return counter.exists && compareCounter(counter.value, condition.operator, condition.value);
		case "between":
			if (!counter.exists) return false;
			return condition.inclusive
				? counter.value >= condition.min && counter.value <= condition.max
				: counter.value > condition.min && counter.value < condition.max;
		case "exists":
			return counter.exists;
		case "missing":
			return !counter.exists;
	}
}

function evaluateCurrentRoom(
	world: World,
	game: GameState,
	condition: Extract<SingleCondition, {type: "current-room"}>,
): boolean {
	switch (condition.operation) {
		case "is":
			return compareIds(game.currentRoom, condition.roomId);
		case "is-not":
			return !compareIds(game.currentRoom, condition.roomId);
		case "has-tag": {
			const roomState = game.roomStates.find((state) => compareIds(state.id, game.currentRoom));
			const tags = roomState?.tags ?? getRoom(world, game.currentRoom).tags;
			return tags.includes(condition.tag);
		}
		case "missing-tag": {
			const roomState = game.roomStates.find((state) => compareIds(state.id, game.currentRoom));
			const tags = roomState?.tags ?? getRoom(world, game.currentRoom).tags;
			return !tags.includes(condition.tag);
		}
	}
}

export function evaluateSingleCondition(
	world: World,
	game: GameState,
	condition: SingleCondition,
): boolean {
	switch (condition.type) {
		case "flag":
			return evaluateFlag(game, condition);
		case "counter":
			return evaluateCounter(game, condition);
		case "current-room":
			return evaluateCurrentRoom(world, game, condition);
		default:
			return false;
	}
}
