import type {Room, World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import type {GameMessageType, GameState} from "@/schemas/states/gameStateSchemas";
import type {ItemState} from "@/schemas/states/entityStateSchemas";
import {createGameMessage} from "./createMessage";
import {GameMessage} from "@/schemas/states/gameStateSchemas";
import {getRoom} from "../utils/lookupUtils";
import {produce} from "immer";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {findAuthoredItem} from "../items/itemRuntime";

export function addMessage(game: GameState, message: string, type: GameMessageType): GameState {
	return produce(game, (draft) => {
		draft.messages.push(createGameMessage(message, type));
	});
}

export function lookAtRoom(world: World, game: GameState, forceFullDescription = true): GameState {
	const room = getRoom(world, game.player.currentRoom);
	const roomMessage = createRoomMessage(world, room, game, {forceFullDescription});

	return produce(game, (draft) => {
		draft.messages.push(roomMessage);
	});
}

export function createRoomMessage(
	world: World,
	room: Room,
	gameState: GameState,
	options: {forceFullDescription?: boolean} = {},
): GameMessage {
	const roomState = gameState.roomStates.find((state) => compareIds(state.id, room.id));
	const hasVisited = roomState?.flags.visited ?? false;
	const name = roomState?.name ?? room.name;
	const description =
		hasVisited && !options.forceFullDescription
			? roomState?.shortDescription ||
				roomState?.description ||
				room.shortDescription ||
				room.description
			: (roomState?.description ?? room.description);
	const roomFragments = room.descriptionFragments
		.filter((fragment) => evaluateCondition(world, gameState, fragment.when))
		.map((fragment) => fragment.text);
	let text = `${name}\n${[description, ...roomFragments].filter(Boolean).join("\n")}\n`;

	const listingLines = gameState.itemStates.flatMap((itemState) => {
		if (itemState.location.type !== "room" || !compareIds(itemState.location.roomId, room.id)) {
			return [];
		}
		return createItemListingLines(world, gameState, itemState, 1);
	});
	if (listingLines.length > 0) text += `${listingLines.join("\n")}\n`;

	return createGameMessage(`${text}\n`, "room", {roomId: room.id});
}

function createItemListingLines(
	world: World,
	gameState: GameState,
	itemState: ItemState,
	depth: number,
): string[] {
	if ((itemState.flags.hidden ?? false) || !itemState.listedInRoom) return [];

	const authored = findAuthoredItem(world, itemState.id, gameState);
	const fragments = (authored?.presentation.conditionalText ?? [])
		.filter((fragment) => evaluateCondition(world, gameState, fragment.when))
		.map((fragment) => fragment.text);
	const indent = " ".repeat(depth);
	const lines = [itemState.listingText || itemState.description, ...fragments]
		.filter(Boolean)
		.flatMap((itemText) => itemText.split("\n"))
		.map((line) => `${indent}${line}`);

	for (const childState of gameState.itemStates) {
		if (
			childState.location.type !== "item" ||
			!compareIds(childState.location.itemId, itemState.id) ||
			(childState.location.placement === "inside" && !itemState.open)
		) {
			continue;
		}
		lines.push(...createItemListingLines(world, gameState, childState, depth + 1));
	}

	return lines;
}
