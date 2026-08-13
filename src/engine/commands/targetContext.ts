import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, idValue, type ID} from "@/utils/idUtils";
import type {MatchBlockContext, TargetMatchCandidate} from "./blocks";
import {getAvailableExits} from "../player/move";
import {itemAccess} from "../items/itemRuntime";

function reachableRoomIds(world: World, game: GameState): Set<string> {
	const reachable = new Set<string>([idValue(game.player.currentRoom)]);
	const currentRoomState = game.roomStates.find((room) =>
		compareIds(room.id, game.player.currentRoom),
	);
	if (!currentRoomState) return reachable;

	for (const exit of getAvailableExits(world, game)) {
		reachable.add(idValue(exit.destinationRoomId));
	}

	return reachable;
}

function roomSources(
	roomId: ID<"room">,
	game: GameState,
	reachable: Set<string>,
): TargetMatchCandidate["sources"] {
	const sources: TargetMatchCandidate["sources"] = [];
	const isCurrentRoom = compareIds(roomId, game.player.currentRoom);
	const roomState = game.roomStates.find((room) => compareIds(room.id, roomId));

	if (isCurrentRoom) sources.push("current-room", "visible");
	if (reachable.has(idValue(roomId))) sources.push("reachable");
	if (isCurrentRoom || roomState?.flags.visited) sources.push("known");

	return sources;
}

function itemSources(itemId: ID<"item">, game: GameState): TargetMatchCandidate["sources"] {
	const sources: TargetMatchCandidate["sources"] = [];
	const item = game.itemStates.find((candidate) => compareIds(candidate.id, itemId));
	if (
		!item ||
		item.flags.hidden ||
		item.location.type === "hidden" ||
		item.location.type === "destroyed"
	) {
		return sources;
	}

	let location = item.location;
	let accessible = true;
	const seen = new Set<string>([idValue(item.id)]);
	while (location.type === "item") {
		const parentItemId = location.itemId;
		const parentId = idValue(parentItemId);
		if (seen.has(parentId)) return sources;
		seen.add(parentId);
		const parent = game.itemStates.find((candidate) => compareIds(candidate.id, parentItemId));
		if (
			!parent ||
			parent.flags.hidden ||
			parent.location.type === "hidden" ||
			parent.location.type === "destroyed"
		) {
			return sources;
		}
		if (location.placement === "inside" && !parent.open) accessible = false;
		location = parent.location;
	}

	if (location.type === "inventory") {
		if (accessible) sources.push("visible", "reachable");
		sources.push("known");
		return sources;
	}

	if (location.type !== "room") return sources;
	const isCurrentRoom = compareIds(location.roomId, game.player.currentRoom);
	if (isCurrentRoom && accessible) sources.push("current-room", "visible", "reachable");
	if (itemAccess(game, itemId).known) sources.push("known");

	return sources;
}

/**
 * Builds target candidates from the complete runtime entity snapshot. Runtime
 * names, aliases, tags, flags, and item locations are authoritative; the
 * authored world supplies connection topology for reachability.
 */
export function resolveTargetMatchContext(world: World, game: GameState): MatchBlockContext {
	const reachable = reachableRoomIds(world, game);
	const targets: TargetMatchCandidate[] = [];

	for (const room of game.roomStates) {
		targets.push({
			reference: room.id,
			name: room.name,
			aliases: [...room.aliases],
			tags: [...room.tags],
			sources: roomSources(room.id, game, reachable),
		});
	}

	for (const item of game.itemStates) {
		targets.push({
			reference: item.id,
			name: item.name,
			aliases: [...item.aliases],
			tags: [...new Set([...item.tags, ...item.behaviorTags])],
			sources: itemSources(item.id, game),
		});
	}

	return {targets, facing: game.player.facing};
}
