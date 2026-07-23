import type {GameMessage, GameState} from "@/schemas/states/gameStateSchema";
import {type Effect} from "@/schemas/world/effectSchema";
import {produce} from "immer";
import {appendLastMessage, createGameMessage} from "../messages/createMessage";
import {choose} from "@/utils/choose";
import {compareIds} from "@/utils/idUtils";
import type {Direction} from "@/schemas/world/worldSchema";
import {
	entityFlagMutationError,
	getEntityFlagDefinition,
} from "@/schemas/world/entityFlagDefinitions";

const ALL_DIRECTIONS: Direction[] = [
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w",
	"nw",
	"up",
	"down",
	"in",
	"out",
];

export function resolveMessageEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "message") {
		return game;
	}

	let message: GameMessage;
	switch (effect.operation) {
		case "show":
			message = createGameMessage(effect.message, "system");
			break;
		case "random":
			message = createGameMessage(choose(effect.messages) ?? "", "system");
			break;
		case "append-last-message":
			return appendLastMessage(game, effect.message, effect.format);
		default:
			return game;
	}

	return produce(game, (draft) => {
		draft.messages.push(message);
	});
}

export function resolveFlagEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "flag") {
		return game;
	}

	if (effect["flag-type"] === "room" || effect["flag-type"] === "feature") {
		return produce(game, (draft) => {
			const roomState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
			if (!roomState) return;

			const isFeatureFlag = effect["flag-type"] === "feature";
			const definition = getEntityFlagDefinition(effect["flag-type"], effect.flag);
			if (entityFlagMutationError(effect["flag-type"], effect.flag, effect.operation)) return;

			const flags = isFeatureFlag
				? roomState.featureStates.find((feature) => compareIds(feature.id, effect.featureId))?.flags
				: roomState.flags;
			if (!flags) return;

			switch (effect.operation) {
				case "set":
					flags[effect.flag] = effect.value;
					break;
				case "toggle":
					flags[effect.flag] = !flags[effect.flag];
					break;
				case "delete":
					if (!definition?.permanent) delete flags[effect.flag];
					break;
			}
		});
	}

	return produce(game, (draft) => {
		const flagRecordIndex = draft.variables.flags.findIndex((record) =>
			Object.hasOwn(record, effect.flag),
		);

		const flagRecord = flagRecordIndex >= 0 ? draft.variables.flags[flagRecordIndex] : undefined;

		switch (effect.operation) {
			case "create":
			case "set": {
				if (flagRecord) {
					flagRecord[effect.flag] = effect.value;
				} else {
					draft.variables.flags.push({
						[effect.flag]: effect.value,
					});
				}
				break;
			}

			case "toggle": {
				if (flagRecord) {
					flagRecord[effect.flag] = !flagRecord[effect.flag];
				} else {
					draft.variables.flags.push({
						[effect.flag]: true,
					});
				}
				break;
			}

			case "delete": {
				if (!flagRecord) {
					break;
				}

				delete flagRecord[effect.flag];

				// Remove the record if deleting the flag left it empty.
				if (Object.keys(flagRecord).length === 0) {
					draft.variables.flags.splice(flagRecordIndex, 1);
				}
				break;
			}
		}
	});
}

export function resolveCounterEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "counter") {
		return game;
	}

	return produce(game, (draft) => {
		const counterRecordIndex = draft.variables.counters.findIndex((record) =>
			Object.hasOwn(record, effect.counter),
		);

		const counterRecord =
			counterRecordIndex >= 0 ? draft.variables.counters[counterRecordIndex] : undefined;

		switch (effect.operation) {
			case "create":
			case "set": {
				if (counterRecord) {
					counterRecord[effect.counter] = effect.value;
				} else {
					draft.variables.counters.push({
						[effect.counter]: effect.value,
					});
				}
				break;
			}

			case "decrease":
				if (counterRecord) {
					counterRecord[effect.counter] = counterRecord[effect.counter] - effect.amount;
				} else {
					draft.variables.counters.push({
						[effect.counter]: -effect.amount,
					});
				}
				break;

			case "increase": {
				if (counterRecord) {
					counterRecord[effect.counter] = counterRecord[effect.counter] + effect.amount;
				} else {
					draft.variables.counters.push({
						[effect.counter]: effect.amount,
					});
				}
				break;
			}

			case "delete": {
				if (!counterRecord) {
					break;
				}

				delete counterRecord[effect.counter];

				// Remove the record if deleting the counter left it empty.
				if (Object.keys(counterRecord).length === 0) {
					draft.variables.counters.splice(counterRecordIndex, 1);
				}
				break;
			}
		}
	});
}

export function resolveFeatureEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "feature") {
		return game;
	}

	return produce(game, (draft) => {
		const roomState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
		if (!roomState) {
			return;
		}

		const featureStateIndex = roomState.featureStates.findIndex((feature) =>
			compareIds(feature.id, effect.featureId),
		);
		const featureState = roomState.featureStates[featureStateIndex];
		if (!featureState) {
			return;
		}

		switch (effect.operation) {
			case "change-name":
				featureState.name = effect.value;
				break;

			case "change-description":
				featureState.description = effect.value;
				break;

			case "move-to-room": {
				const newRoomState = draft.roomStates.find((room) => compareIds(room.id, effect.newRoomId));
				if (!newRoomState || newRoomState === roomState) {
					break;
				}

				roomState.featureStates.splice(featureStateIndex, 1);
				newRoomState.featureStates.push(featureState);
				break;
			}

			case "hide-from-player":
				featureState.flags.hidden = true;
				break;

			case "show-to-player":
				featureState.flags.hidden = false;
				break;

			case "show-in-room-description":
				featureState.flags.listedInRoom = true;
				break;

			case "hide-in-room-description":
				featureState.flags.listedInRoom = false;
				break;

			case "destroy":
				roomState.featureStates.splice(featureStateIndex, 1);
				break;
		}
	});
}

export function resolveRoomEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "room") {
		return game;
	}

	if (effect.operation === "move-player-to") {
		return produce(game, (draft) => {
			draft.currentRoom = effect.roomId;
			const destinationState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
			if (destinationState) {
				destinationState.flags.visited = true;
			}
		});
	}

	return produce(game, (draft) => {
		const roomState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
		if (!roomState) {
			return;
		}

		switch (effect.operation) {
			case "set-name":
				roomState.name = effect.variantId;
				break;

			case "set-description":
				roomState.description = effect.variantId;
				break;

			case "set-short-description":
				roomState.shortDescription = effect.variantId;
				break;

			case "lock-exit": {
				const direction = effect.direction as Direction;
				roomState.lockedExits ??= [];
				if (!roomState.lockedExits.includes(direction)) {
					roomState.lockedExits.push(direction);
				}
				break;
			}

			case "unlock-exit": {
				const direction = effect.direction as Direction;
				roomState.lockedExits =
					roomState.lockedExits?.filter((candidate) => candidate !== direction) ?? [];
				break;
			}

			case "lock-all-exits":
				roomState.lockedExits = [...ALL_DIRECTIONS];
				break;

			case "unlock-all-exits":
				roomState.lockedExits = [];
				break;

			case "add-tag":
				roomState.tags ??= [];
				if (!roomState.tags.includes(effect.tag)) {
					roomState.tags.push(effect.tag);
				}
				break;

			case "remove-tag":
				roomState.tags = roomState.tags?.filter((tag) => tag !== effect.tag) ?? [];
				break;

			case "set-active":
				roomState.flags.active = true;
				break;

			case "set-inactive":
				roomState.flags.active = false;
				break;
		}
	});
}
