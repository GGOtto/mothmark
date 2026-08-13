import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {SingleCondition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
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
	playerCanCarry,
} from "../items/itemRuntime";
import {matchingItems} from "../items/itemCollections";
import {ITEM_SIZE_UNITS} from "@/schemas/world/itemSchema";

function expected(actual: boolean, value: boolean): boolean {
	return actual === value;
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

function evaluateWorld(
	game: GameState,
	condition: Extract<SingleCondition, {type: "world"}>,
): boolean {
	if (condition.operation === "counter-compare-counter") {
		const left = findVariable(game.variables.counters, condition.leftCounter);
		const right = findVariable(game.variables.counters, condition.rightCounter);
		return left.exists && right.exists && compareCounter(left.value, condition.operator, right.value);
	}
	if ("flag" in condition) {
		const flag = findVariable(game.variables.flags, condition.flag);
		switch (condition.operation) {
			case "flag-is":
				return flag.exists && flag.value === condition.value;
			case "flag-exists":
				return flag.exists;
			case "flag-missing":
				return !flag.exists;
		}
	}
	if ("counter" in condition) {
		const counter = findVariable(game.variables.counters, condition.counter);
		switch (condition.operation) {
			case "counter-compare":
				return counter.exists && compareCounter(counter.value, condition.operator, condition.value);
			case "counter-between":
				return (
					counter.exists &&
					(condition.inclusive
						? counter.value >= condition.min && counter.value <= condition.max
						: counter.value > condition.min && counter.value < condition.max)
				);
			case "counter-exists":
				return counter.exists;
			case "counter-missing":
				return !counter.exists;
		}
	}

	if (!("text" in condition)) return false;
	const text = findVariable(game.variables.texts, condition.text);
	switch (condition.operation) {
		case "text-is":
			return text.exists && text.value === condition.value;
		case "text-is-not":
			return text.exists && text.value !== condition.value;
		case "text-starts-with":
			return text.exists && text.value.startsWith(condition.value);
		case "text-does-not-start-with":
			return text.exists && !text.value.startsWith(condition.value);
		case "text-ends-with":
			return text.exists && text.value.endsWith(condition.value);
		case "text-does-not-end-with":
			return text.exists && !text.value.endsWith(condition.value);
		case "text-contains":
			return text.exists && text.value.includes(condition.value);
		case "text-does-not-contain":
			return text.exists && !text.value.includes(condition.value);
		case "text-is-empty":
			return text.exists && text.value.length === 0;
		case "text-is-not-empty":
			return text.exists && text.value.length > 0;
		case "text-exists":
			return text.exists;
		case "text-missing":
			return !text.exists;
		default:
			return false;
	}
}

function evaluateItemCollection(
	world: World,
	game: GameState,
	condition: Extract<SingleCondition, {type: "items"}>,
): boolean {
	const items = matchingItems(world, game, condition);
	switch (condition.operation) {
		case "matching-exists":
			return items.length > 0;
		case "matching-missing":
			return items.length === 0;
		case "matching-count":
			return compareCounter(items.length, condition.operator, condition.value);
		case "matching-total-size": {
			const total = items.reduce((sum, item) => {
				const authored = findAuthoredItem(world, item.id, game);
				const takeable = authored && findBehavior(authored, "takeable");
				return sum + (takeable ? ITEM_SIZE_UNITS[takeable.size] : 0);
			}, 0);
			return compareCounter(total, condition.operator, condition.value);
		}
		case "all-matching-have-flag":
			return (
				(!condition.requireMatch || items.length > 0) &&
				items.every((item) => item.flags[condition.flag] === condition.value)
			);
	}
}

function evaluateEntityFlag(
	flags: Record<string, boolean>,
	condition: {operation: "flag-is" | "flag-exists" | "flag-missing"; flag: string; value?: boolean},
): boolean {
	const exists = Object.hasOwn(flags, condition.flag);
	if (condition.operation === "flag-exists") return exists;
	if (condition.operation === "flag-missing") return !exists;
	return exists && flags[condition.flag] === condition.value;
}

function evaluateItem(
	world: World,
	game: GameState,
	condition: Extract<SingleCondition, {type: "item"}>,
): boolean {
	const item = findItemState(game, condition.itemId);
	const authored = findAuthoredItem(world, condition.itemId, game);
	if (!item) return false;
	const access = itemAccess(game, condition.itemId);

	switch (condition.operation) {
		case "is-visible":
			return expected(access.visible, condition.value);
		case "is-reachable":
			return expected(access.reachable, condition.value);
		case "is-known":
			return expected(access.known, condition.value);
		case "is-carried":
			return expected(access.carried, condition.value);
		case "is-hidden":
			return expected(Boolean(item.flags.hidden || item.location.type === "hidden"), condition.value);
		case "is-destroyed":
			return expected(item.location.type === "destroyed", condition.value);
		case "is-examined":
			return expected(Boolean(item.flags.examined), condition.value);
		case "is-listed":
			return expected(item.listedInRoom, condition.value);
		case "is-open":
			return expected(item.open, condition.value);
		case "is-locked":
			return expected(item.locked, condition.value);
		case "location-is-hidden":
			return expected(item.location.type === "hidden", condition.value);
		case "location-is-destroyed":
			return expected(item.location.type === "destroyed", condition.value);
		case "is-in-current-room": {
			const root = rootItemLocation(game, condition.itemId);
			return root?.type === "room" && compareIds(root.roomId, game.player.currentRoom);
		}
		case "is-in-inventory":
			return rootItemLocation(game, condition.itemId)?.type === "inventory";
		case "is-in-room": {
			const root = rootItemLocation(game, condition.itemId);
			return root?.type === "room" && compareIds(root.roomId, condition.roomId);
		}
		case "is-inside":
		case "is-on":
			return (
				item.location.type === "item" &&
				item.location.placement === (condition.operation === "is-inside" ? "inside" : "on") &&
				compareIds(item.location.itemId, condition.parentItemId)
			);
		case "has-behavior":
			return expected(
				Boolean(authored && findBehavior(authored, condition.behavior)),
				condition.value,
			);
		case "has-tag":
			return expected(item.tags.includes(condition.tag), condition.value);
		case "contents-empty":
			return expected(
				directContents(game, condition.itemId, condition.placement).length === 0,
				condition.value,
			);
		case "contains-item":
			return directContents(game, condition.itemId, condition.placement).some((child) =>
				compareIds(child.id, condition.containedItemId),
			);
		case "contains-tag":
			return directContents(game, condition.itemId, condition.placement).some((child) =>
				child.tags.includes(condition.tag),
			);
		case "capacity-is-empty":
			return expected(
				directContents(game, condition.itemId, condition.placement).length === 0,
				condition.value,
			);
		case "capacity-is-full":
			return expected(
				remainingCapacity(world, game, condition.itemId, condition.placement) === 0,
				condition.value,
			);
		case "can-fit-item":
			return canPlaceItem(
				world,
				game,
				condition.candidateItemId,
				condition.itemId,
				condition.placement,
			);
		case "can-be-unlocked-by":
			return keyUnlocks(world, game, condition.itemId, condition.keyItemId);
		case "controls-connection":
			return expected(
				doorControlsConnection(world, condition.itemId, condition.connectionId),
				condition.value,
			);
		case "connection-is-passable":
			return expected(
				doorConnectionPassable(world, game, condition.itemId, condition.connectionId),
				condition.value,
			);
		case "flag-is":
		case "flag-exists":
		case "flag-missing":
			return evaluateEntityFlag(item.flags, condition);
	}
}

function evaluateRoom(
	game: GameState,
	condition: Extract<SingleCondition, {type: "room"}>,
): boolean {
	if (condition.operation === "current-flag-is") {
		const room = game.roomStates.find((state) => compareIds(state.id, game.player.currentRoom));
		return room
			? Object.hasOwn(room.flags, condition.flag) && room.flags[condition.flag] === condition.value
			: false;
	}
	if (condition.operation === "current-has-tag" || condition.operation === "current-missing-tag") {
		const room = game.roomStates.find((state) => compareIds(state.id, game.player.currentRoom));
		if (!room) return false;
		const hasTag = room.tags.includes(condition.tag);
		return condition.operation === "current-has-tag" ? hasTag : !hasTag;
	}
	if (!("roomId" in condition)) return false;
	const room = game.roomStates.find((state) => compareIds(state.id, condition.roomId));
	return room ? evaluateEntityFlag(room.flags, condition) : false;
}

function evaluatePlayer(
	world: World,
	game: GameState,
	condition: Extract<SingleCondition, {type: "player"}>,
): boolean {
	switch (condition.operation) {
		case "is-in-room":
			return compareIds(game.player.currentRoom, condition.roomId);
		case "is-not-in-room":
			return !compareIds(game.player.currentRoom, condition.roomId);
		case "is-alive":
			return !game.player.isDead;
		case "is-dead":
			return Boolean(game.player.isDead);
		case "has-won":
			return Boolean(game.player.hasWon);
		case "has-not-won":
			return !game.player.hasWon;
		case "game-has-ended":
			return Boolean(game.player.isEnded);
		case "game-is-continuing":
			return !game.player.isEnded;
		case "is-frozen":
			return Boolean(game.player.freezeState.frozen);
		case "is-unfrozen":
			return !game.player.freezeState.frozen;
		case "facing-is":
			return game.player.facing === condition.direction;
		case "turn-compare":
			return compareCounter(game.player.turns, condition.operator, condition.value);
		case "is-equipped":
			return (game.player.equippedItemIds ?? []).some((itemId) =>
				compareIds(itemId, condition.itemId),
			);
		case "is-not-equipped":
			return !(game.player.equippedItemIds ?? []).some((itemId) =>
				compareIds(itemId, condition.itemId),
			);
		case "can-carry":
			return playerCanCarry(world, game, condition.itemId);
		case "previous-room-is":
			return Boolean(
				game.player.previousRoom && compareIds(game.player.previousRoom, condition.roomId),
			);
		case "entered-room-this-turn":
			return (
				game.player.lastRoomTransitionTurn === game.player.turns &&
				compareIds(game.player.currentRoom, condition.roomId)
			);
		case "left-room-this-turn":
			return (
				game.player.lastRoomTransitionTurn === game.player.turns &&
				Boolean(game.player.previousRoom && compareIds(game.player.previousRoom, condition.roomId))
			);
		case "last-command-succeeded":
			return (
				game.player.lastCommandTurn === game.player.turns && game.player.lastCommandSucceeded === true
			);
		case "last-command-failed":
			return (
				game.player.lastCommandTurn === game.player.turns && game.player.lastCommandSucceeded === false
			);
	}
}

function evaluateEvent(
	game: GameState,
	condition: Extract<SingleCondition, {type: "event"}>,
): boolean {
	const event = game.events.find((candidate) => compareIds(candidate.id, condition.eventId));
	if (condition.operation === "is-scheduled") return Boolean(event);
	if (condition.operation === "is-cancelled") return !event;
	if (!event) return false;
	if (condition.operation === "is-enabled") return event.enabled;
	if (condition.operation === "is-disabled") return !event.enabled;
	return game.player.turns - event.lastSuccess >= event.wait;
}

export function evaluateSingleCondition(
	world: World,
	game: GameState,
	condition: SingleCondition,
): boolean {
	switch (condition.type) {
		case "world":
			return evaluateWorld(game, condition);
		case "item":
			return evaluateItem(world, game, condition);
		case "items":
			return evaluateItemCollection(world, game, condition);
		case "room":
			return evaluateRoom(game, condition);
		case "player":
			return evaluatePlayer(world, game, condition);
		case "navigation":
			return isExitOpen(world, game, condition.direction);
		case "event":
			return evaluateEvent(game, condition);
	}
}
