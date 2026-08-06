import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {SingleCondition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, ID} from "@/utils/idUtils";
import {EntityState} from "@/schemas/states/entityStateSchemas";
import {findVariable} from "../utils/lookupUtils";
import {isExitOpen} from "../player/move";
import {
	canPlaceItem,
	directContents,
	doorConnectionPassable,
	doorControlsConnection,
	findAuthoredItem,
	findBehavior,
	findItemState,
	itemAccess,
	keyUnlocks,
	remainingCapacity,
	rootItemLocation,
} from "../items/itemRuntime";

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
	if (condition["flag-type"] === "item") {
		const item = findStateById(game.itemStates, condition.itemId);
		if (!item || item.type !== "item") return false;
		return evaluateFlagValue(item.flags, condition.flag, condition.operation);
	}

	const flag = findVariable(game.variables.flags, condition.flag);
	return evaluateFlagResult(flag.exists, flag.value, condition.operation);
}

function expected(actual: boolean, value: boolean): boolean {
	return actual === value;
}

function evaluateItem(
	world: World,
	game: GameState,
	condition: Extract<SingleCondition, {type: "item"}>,
): boolean {
	const itemId = condition.itemId;
	const item = findItemState(game, itemId);
	const authored = findAuthoredItem(world, itemId);
	if (!item || !authored) return false;
	const test = condition.test;

	switch (test.type) {
		case "state": {
			const access = itemAccess(game, itemId);
			const states = {
				visible: access.visible,
				reachable: access.reachable,
				known: access.known,
				carried: access.carried,
				hidden: Boolean(item.flags.hidden || item.location.type === "hidden"),
				destroyed: item.location.type === "destroyed",
				examined: Boolean(item.flags.examined),
				listed: item.listedInRoom,
				open: item.open,
				locked: item.locked,
			};
			return expected(states[test.state], test.value);
		}
		case "location": {
			if (test.location === "inside-item" || test.location === "on-item") {
				return Boolean(
					item.location.type === "item" &&
					item.location.placement === (test.location === "inside-item" ? "inside" : "on") &&
					compareIds(item.location.itemId, test.parentItemId),
				);
			}
			if (test.location === "hidden" || test.location === "destroyed") {
				return item.location.type === test.location;
			}
			const root = rootItemLocation(game, itemId);
			if (test.location === "inventory") return root?.type === "inventory";
			if (test.location === "current-room") {
				return root?.type === "room" && compareIds(root.roomId, game.player.currentRoom);
			}
			return test.location === "room" && root?.type === "room"
				? compareIds(root.roomId, test.roomId)
				: false;
		}
		case "important-tag":
			return expected(Boolean(findBehavior(authored, test.tag)), test.value);
		case "tag":
			return expected(item.tags.includes(test.tag), test.value);
		case "contents": {
			const contents = directContents(game, itemId, test.placement);
			if (test.test === "empty") return expected(contents.length === 0, test.value);
			if (test.test === "contains-tag") return contents.some((child) => child.tags.includes(test.tag));
			return contents.some((child) => compareIds(child.id, test.itemId));
		}
		case "capacity":
			if (test.test === "can-fit") {
				return canPlaceItem(world, game, test.itemId, itemId, test.placement);
			}
			return expected(
				test.test === "empty"
					? directContents(game, itemId, test.placement).length === 0
					: remainingCapacity(world, game, itemId, test.placement) === 0,
				test.value,
			);
		case "can-unlock": {
			return keyUnlocks(world, game, test.lockItemId, test.keyItemId);
		}
		case "door":
			return expected(
				test.test === "controls-connection"
					? doorControlsConnection(world, itemId, test.connectionId)
					: doorConnectionPassable(world, game, itemId, test.connectionId),
				test.value,
			);
	}
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
			return compareIds(game.player.currentRoom, condition.roomId);
		case "is-not":
			return !compareIds(game.player.currentRoom, condition.roomId);
		case "has-tag": {
			const roomState = game.roomStates.find((state) => compareIds(state.id, game.player.currentRoom));
			return roomState?.tags.includes(condition.tag) ?? false;
		}
		case "missing-tag": {
			const roomState = game.roomStates.find((state) => compareIds(state.id, game.player.currentRoom));
			return roomState ? !roomState.tags.includes(condition.tag) : false;
		}
		case "is-exit-open":
			return isExitOpen(world, game, condition.direction);
		default:
			return false;
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
		case "item":
			return evaluateItem(world, game, condition);
		default:
			return false;
	}
}
