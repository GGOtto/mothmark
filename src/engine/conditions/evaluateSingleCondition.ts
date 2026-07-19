import type {GameState} from "@/schemas/states/gameStateSchema";
import type {SingleCondition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import {getRoom} from "../utils/worldLookupUtils";

type VariableLookup<TValue> = {exists: true; value: TValue} | {exists: false; value: undefined};

function findVariable<TValue>(
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

function evaluateFlag(
	game: GameState,
	condition: Extract<SingleCondition, {type: "flag"}>,
): boolean {
	const flag = findVariable(game.variables.flags, condition.flag);

	switch (condition.operation) {
		case "true":
			return flag.exists && flag.value;
		case "false":
			return flag.exists && !flag.value;
		case "exists":
			return flag.exists;
		case "missing":
			return !flag.exists;
	}
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
	const counter = findVariable(game.variables.counter, condition.counter);

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
		case "has-tag":
			return getRoom(world, game.currentRoom).tags.includes(condition.tag);
		case "missing-tag":
			return !getRoom(world, game.currentRoom).tags.includes(condition.tag);
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
