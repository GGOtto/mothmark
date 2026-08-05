import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {Connection, Direction, World} from "@/schemas/world/worldSchema";
import {compareIds, idValue, type ID} from "@/utils/idUtils";
import type {MatchBlockContext, TargetMatchCandidate} from "./blocks";

function canTravelForward(connection: Connection) {
	return connection.pathway === "two-way" || connection.pathway === "forwards";
}

function canTravelBackward(connection: Connection) {
	return connection.pathway === "two-way" || connection.pathway === "backwards";
}

function reachableRoomIds(world: World, game: GameState): Set<string> {
	const reachable = new Set<string>([idValue(game.player.currentRoom)]);
	const currentRoomState = game.roomStates.find((room) =>
		compareIds(room.id, game.player.currentRoom),
	);
	if (!currentRoomState) return reachable;

	for (const connection of world.connections) {
		let direction: Direction | undefined;
		let destinationId: ID<"room"> | undefined;

		if (compareIds(connection.fromRoomId, game.player.currentRoom) && canTravelForward(connection)) {
			direction = connection.direction;
			destinationId = connection.toRoomId;
		} else if (
			compareIds(connection.toRoomId, game.player.currentRoom) &&
			canTravelBackward(connection)
		) {
			direction = connection.returnDirection;
			destinationId = connection.fromRoomId;
		}

		if (!direction || !destinationId || currentRoomState.lockedExits.includes(direction)) continue;
		const destination = game.roomStates.find((room) => compareIds(room.id, destinationId));
		if (destination?.flags.active ?? false) reachable.add(idValue(destinationId));
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

function featureSources(
	roomId: ID<"room">,
	hidden: boolean,
	listedInRoom: boolean,
	examined: boolean,
	roomVisited: boolean,
	game: GameState,
): TargetMatchCandidate["sources"] {
	const sources: TargetMatchCandidate["sources"] = [];
	const isCurrentRoom = compareIds(roomId, game.player.currentRoom);

	if (isCurrentRoom) sources.push("current-room");
	if (isCurrentRoom && !hidden) sources.push("visible", "reachable");
	if (examined || (roomVisited && !hidden && listedInRoom)) sources.push("known");

	return sources;
}

/**
 * Builds target candidates from the complete runtime entity snapshot. Runtime
 * names, aliases, tags, flags, and feature locations are authoritative; the
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

		for (const feature of room.featureStates) {
			targets.push({
				reference: feature.id,
				name: feature.name,
				aliases: [...feature.aliases],
				tags: [...feature.tags],
				sources: featureSources(
					room.id,
					feature.flags.hidden ?? false,
					feature.listedInRoom,
					feature.flags.examined ?? false,
					room.flags.visited ?? false,
					game,
				),
			});
		}
	}

	return {targets};
}
