import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ItemState} from "@/schemas/states/entityStateSchemas";
import type {Item, ItemBehavior} from "@/schemas/world/itemSchema";
import {ITEM_SIZE_UNITS} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, idValue, type ID} from "@/utils/idUtils";
import {isConnectionBlockedByDoor} from "../player/move";

export function findItemState(game: GameState, id: ID<"item">): ItemState | undefined {
	return game.itemStates.find((item) => compareIds(item.id, id));
}

export function findAuthoredItem(world: World, id: ID<"item">, game?: GameState): Item | undefined {
	const direct = world.items.find((item) => compareIds(item.id, id));
	if (direct || !game) return direct;
	const templateId = findItemState(game, id)?.templateItemId;
	return templateId ? world.items.find((item) => compareIds(item.id, templateId)) : undefined;
}

export function findBehavior<TType extends ItemBehavior["type"]>(
	item: Item | undefined,
	type: TType,
): Extract<ItemBehavior, {type: TType}> | undefined {
	return item?.behaviors.find(
		(behavior): behavior is Extract<ItemBehavior, {type: TType}> => behavior.type === type,
	);
}

export function itemAccess(game: GameState, id: ID<"item">) {
	const item = findItemState(game, id);
	if (
		!item ||
		item.flags.hidden ||
		item.location.type === "hidden" ||
		item.location.type === "destroyed"
	) {
		return {visible: false, reachable: false, known: false, carried: false};
	}

	let location = item.location;
	let accessible = true;
	const seen = new Set([idValue(id)]);
	while (location.type === "item") {
		if (seen.has(idValue(location.itemId))) {
			return {visible: false, reachable: false, known: false, carried: false};
		}
		seen.add(idValue(location.itemId));
		const parent = findItemState(game, location.itemId);
		if (
			!parent ||
			parent.flags.hidden ||
			parent.location.type === "hidden" ||
			parent.location.type === "destroyed"
		) {
			return {visible: false, reachable: false, known: false, carried: false};
		}
		if (location.placement === "inside" && !parent.open) accessible = false;
		location = parent.location;
	}

	if (location.type === "inventory") {
		return {visible: accessible, reachable: accessible, known: true, carried: true};
	}
	if (location.type !== "room") {
		return {visible: false, reachable: false, known: false, carried: false};
	}
	const currentRoom = compareIds(location.roomId, game.player.currentRoom);
	const room = game.roomStates.find((candidate) => compareIds(candidate.id, location.roomId));
	return {
		visible: currentRoom && accessible,
		reachable: currentRoom && accessible,
		known: Boolean(
			item.flags.examined || (room?.flags.visited && itemIsListedThroughParents(game, id)),
		),
		carried: false,
	};
}

export function itemIsListedThroughParents(game: GameState, id: ID<"item">): boolean {
	let item = findItemState(game, id);
	const seen = new Set<string>();

	while (item) {
		const itemId = idValue(item.id);
		if (seen.has(itemId) || item.flags.hidden || !item.listedInRoom) return false;
		seen.add(itemId);

		if (item.location.type === "room") return true;
		if (item.location.type !== "item") return false;

		const childLocation = item.location;
		const parent = findItemState(game, childLocation.itemId);
		if (!parent || (childLocation.placement === "inside" && !parent.open)) return false;
		item = parent;
	}

	return false;
}

export function rootItemLocation(game: GameState, id: ID<"item">) {
	let item = findItemState(game, id);
	const seen = new Set<string>();
	while (item?.location.type === "item") {
		if (seen.has(idValue(item.id))) return;
		seen.add(idValue(item.id));
		item = findItemState(game, item.location.itemId);
	}
	return item?.location;
}

export function itemSizeUnits(world: World, id: ID<"item">, game?: GameState): number {
	const size = findBehavior(findAuthoredItem(world, id, game), "takeable")?.size;
	return size ? ITEM_SIZE_UNITS[size] : 0;
}

export function playerCanCarry(world: World, game: GameState, itemId: ID<"item">): boolean {
	if (game.player.carryingCapacity === undefined) return true;
	if (itemAccess(game, itemId).carried) return true;
	const used = game.itemStates.reduce((total, item) => {
		return rootItemLocation(game, item.id)?.type === "inventory"
			? total + itemSizeUnits(world, item.id, game)
			: total;
	}, 0);
	return used + itemSizeUnits(world, itemId, game) <= game.player.carryingCapacity;
}

export function directContents(
	game: GameState,
	parentId: ID<"item">,
	placement: "inside" | "on" | "either",
) {
	return game.itemStates.filter(
		(item) =>
			item.location.type === "item" &&
			compareIds(item.location.itemId, parentId) &&
			(placement === "either" || item.location.placement === placement),
	);
}

export function remainingCapacity(
	world: World,
	game: GameState,
	parentId: ID<"item">,
	placement: "inside" | "on",
): number | undefined {
	const authored = findAuthoredItem(world, parentId, game);
	const behavior = findBehavior(authored, placement === "inside" ? "container" : "surface");
	if (!behavior) return;
	const used = directContents(game, parentId, placement).reduce(
		(total, item) => total + itemSizeUnits(world, item.id, game),
		0,
	);
	return Math.max(0, behavior.capacity.capacity - used);
}

function wouldCreateCycle(game: GameState, itemId: ID<"item">, parentId: ID<"item">): boolean {
	let current = findItemState(game, parentId);
	const seen = new Set<string>();
	while (current) {
		if (compareIds(current.id, itemId)) return true;
		if (seen.has(idValue(current.id)) || current.location.type !== "item") return false;
		seen.add(idValue(current.id));
		current = findItemState(game, current.location.itemId);
	}
	return false;
}

export function canPlaceItem(
	world: World,
	game: GameState,
	itemId: ID<"item">,
	parentId: ID<"item">,
	placement: "inside" | "on",
): boolean {
	if (compareIds(itemId, parentId) || wouldCreateCycle(game, itemId, parentId)) return false;
	const item = findAuthoredItem(world, itemId, game);
	const parent = findAuthoredItem(world, parentId, game);
	const takeable = findBehavior(item, "takeable");
	const capacity = findBehavior(parent, placement === "inside" ? "container" : "surface")?.capacity;
	if (!takeable || !capacity) return false;
	if (
		placement === "inside" &&
		findBehavior(parent, "openable") &&
		!findItemState(game, parentId)?.open
	) {
		return false;
	}
	const size = ITEM_SIZE_UNITS[takeable.size];
	return (
		size <= ITEM_SIZE_UNITS[capacity.maximumItemSize] &&
		size <= (remainingCapacity(world, game, parentId, placement) ?? 0)
	);
}

export function keyUnlocks(
	world: World,
	game: GameState,
	lockId: ID<"item">,
	keyId: ID<"item">,
): boolean {
	const lock = findBehavior(findAuthoredItem(world, lockId, game), "lockable");
	const key = findAuthoredItem(world, keyId, game);
	const state = findItemState(game, keyId);
	if (!lock || !key) return false;
	return lock.unlockWith.some((requirement) =>
		requirement.type === "item"
			? compareIds(requirement.itemId, keyId)
			: key.tags.includes(requirement.tag) || Boolean(state?.tags.includes(requirement.tag)),
	);
}

export function doorControlsConnection(
	world: World,
	itemId: ID<"item">,
	connectionId?: ID<"connection">,
): boolean {
	const door = findBehavior(findAuthoredItem(world, itemId), "door");
	return Boolean(door && (!connectionId || compareIds(door.connectionId, connectionId)));
}

export function doorConnectionPassable(
	world: World,
	game: GameState,
	itemId: ID<"item">,
	connectionId?: ID<"connection">,
): boolean {
	const door = findBehavior(findAuthoredItem(world, itemId), "door");
	if (!door || (connectionId && !compareIds(door.connectionId, connectionId))) return false;
	const connection = world.connections.find((candidate) =>
		compareIds(candidate.id, door.connectionId),
	);
	if (!connection) return false;
	const fromPassable = !isConnectionBlockedByDoor(world, game, connection, connection.fromRoomId);
	const toPassable = !isConnectionBlockedByDoor(world, game, connection, connection.toRoomId);
	return door.controls === "forward"
		? fromPassable
		: door.controls === "backward"
			? toPassable
			: fromPassable && toPassable;
}
